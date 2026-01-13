import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RepoSummary } from './schemas/summary.schema';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AppService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(
    @InjectModel(RepoSummary.name) private summaryModel: Model<RepoSummary>,
    private configService: ConfigService
  ) 
  {
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY mancante nel file .env');
    this.genAI = new GoogleGenerativeAI(geminiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  }

  async analyzeAndSave(repoUrl: string): Promise<string> {
    const { owner, repo } = this.parseGithubUrl(repoUrl);

    let combinedText = "";
    try {
      combinedText = await this.getRepoContentRecursive(owner, repo, '');
    } catch (e) {
      console.error(`Errore scaricando la repo ${owner}/${repo}:`, e.message);
      throw new HttpException('Impossibile scaricare la repository', HttpStatus.BAD_REQUEST);
    }

    if (!combinedText) {
      return "Nessun file di codice analizzabile trovato nella repo.";
    }

    const truncatedText = combinedText.slice(0, 30000);

    const prompt = `Sei un esperto software architect. Analizza il seguente codice sorgente e crea un riassunto tecnico dettagliato in italiano in massimo 300 parole con un linguaggio non troppo tecnico:\n\n${truncatedText}`;
    
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    const createdSummary = new this.summaryModel({
      repoUrl: repoUrl,
      summaryText: summary
    });

    await createdSummary.save();

    return summary;
  }

  private parseGithubUrl(url: string): { owner: string, repo: string } {
    const cleanUrl = url.replace(/\/$/, ""); 
    const parts = cleanUrl.split('/'); 
    return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
  }

  private async getRepoContentRecursive(owner: string, repo: string, path: string): Promise<string> {
    let contentAccumulator = "";
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const githubToken = this.configService.get<string>('GITHUB_TOKEN'); 

    const headers: any = { 
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'NestJS-PoC-App' 
    };

    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }

    try {
      const response = await axios.get(apiUrl, { headers });
      const items = response.data; 
      
      if (!Array.isArray(items)) return "";

      for (const item of items) {
        if (item.type === 'file') {
          if (this.isCodeFile(item.name)) {
            const fileContent = await this.downloadRawFile(item.download_url);
            contentAccumulator += `\n\n--- FILE: ${item.path} ---\n${fileContent}`;
          }
        } 
        else if (item.type === 'dir') {
          contentAccumulator += await this.getRepoContentRecursive(owner, repo, item.path);
        }
      }
    } 
    catch (error) {
      console.error(`Warning: Saltata cartella/file ${path} - ${error.message}`);
    }

    return contentAccumulator;
  }

  private async downloadRawFile(url: string): Promise<string> {
    try {
        const response = await axios.get(url);
        if (typeof response.data === 'object') {
        return JSON.stringify(response.data, null, 2);
        }
        return response.data;
    } catch (e) {
        return "";
    }
  }

  private isCodeFile(filename: string): boolean {
    const validExtensions = ['.ts', '.js', '.c', '.cpp', '.h', '.hpp', '.py', '.java', '.md', '.txt', '.json'];
    return validExtensions.some(ext => filename.endsWith(ext));
  }

  async getAllSummaries() {
    return this.summaryModel.find().sort({ createdAt: -1 }).exec();
  }
}