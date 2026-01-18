import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RepoSummary } from './schemas/summary.schema';
import axios from 'axios';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

@Injectable()
export class AppService {
  private bedrockClient: BedrockRuntimeClient;

  constructor(
    @InjectModel(RepoSummary.name) private summaryModel: Model<RepoSummary>,
    private configService: ConfigService
  ) {
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const sessionToken = this.configService.get<string>('AWS_SESSION_TOKEN');
    const clientConfig: any = { region };

    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken && { sessionToken })
      };
    }

    this.bedrockClient = new BedrockRuntimeClient(clientConfig);
  }

  async analyzeAndSave(repoUrl: string): Promise<any> {
    const { owner, repo, branch, path } = this.parseGithubUrl(repoUrl);
    console.log(`Analisi avviata: ${owner}/${repo} (Branch: ${branch || 'default'}, Path: ${path || 'root'})`);

    let combinedText = "";
    try {
      combinedText = await this.getRepoContentRecursive(owner, repo, path, branch);
    } catch (e) {
      console.error(`Errore scaricando la repo:`, e.message);
      throw new HttpException('Impossibile scaricare la repository', HttpStatus.BAD_REQUEST);
    }

    if (!combinedText || combinedText.length < 50) {
      return "Nessun contenuto trovato. Controlla che il path sia corretto e che i file (.typ, .ts, etc.) siano supportati.";
    }

    const truncatedText = combinedText.slice(0, 100000);

    const systemPrompt = `Sei un QA Specialist ed esperto di Technical Writing.
Il tuo compito è eseguire una REVISIONE TECNICA (Audit) sulla documentazione fornita (file .typ, .md, txt) per il repository ${owner}/${repo}..

Analizza il testo cercando:
1. **Struttura**: Il documento segue un flusso logico?
2. **Completezza**: Mancano sezioni fondamentali per il tipo di documento (es. Requisiti senza attori, Codice senza commenti)?
3. **Chiarezza**: Ci sono ambiguità o frasi poco chiare sia nei commenti sia nella documentazione?
4. **Errori**: Potenziali incongruenze o errori di formattazione.

Genera un report rigoroso seguendo questo schema:

# 🕵️ Report di Revisione: ${owner}/${repo}
**Giudizio Sintetico**: (Es. "Documentazione solida ma incompleta" o "Ben strutturata").

## ✅ Analisi Qualitativa
* **Struttura e Formattazione**: Valutazione dell'organizzazione del contenuto.
* **Chiarezza Espositiva**: È comprensibile per il target di riferimento?
* **Coerenza**: I termini usati sono uniformi?
* **Rigore commenti**: I commenti utilizzati vengono scritti in maniera consistente e coerente nel testo?

## 🚩 Criticità Rilevate
* Elenco puntato di eventuali mancanze, errori logici, sezioni vuote o poco chiare.
* (Se non ci sono criticità, scrivi "Nessuna criticità rilevante").

## 💡 Suggerimenti di Miglioramento
* Consigli pratici su cosa aggiungere o riscrivere per migliorare la qualità del documento.

Sii costruttivo, professionale e usa l'italiano.`;

    const userMessage = `Repository: ${owner}/${repo} 
    Percorso analizzato: ${path || 'root'}

    Ecco i documenti/codice da revisionare:\n\n${truncatedText}`;

    const payload = {
      system: [{ text: systemPrompt }],
      messages: [
        {
          role: "user",
          content: [{ text: userMessage }]
        }
      ],
      inferenceConfig: {
        max_new_tokens: 2500,
        temperature: 0.2,
        top_p: 0.9
      }
    };

    try {
      const command = new InvokeModelCommand({
        modelId: "eu.amazon.nova-micro-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
      });

      const response = await this.bedrockClient.send(command);

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const summary = responseBody.output.message.content[0].text;

      const createdSummary = new this.summaryModel({
        repoUrl: repoUrl,
        summaryText: summary
      });

      return await createdSummary.save();

    } catch (error) {
      console.error("Errore AWS Bedrock:", error);
      throw new HttpException("Errore durante l'analisi AI con AWS", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // HELPER METHODS 

  private parseGithubUrl(url: string): { owner: string, repo: string, branch?: string, path: string } {
    const cleanUrl = url.replace(/\/$/, "");
    const regex = /github\.com\/([^\/]+)\/([^\/]+)(?:\/(?:tree|blob)\/([^\/]+)(?:\/(.*))?)?/;
    const match = cleanUrl.match(regex);

    if (!match) {
      const parts = cleanUrl.split('/');
      return { owner: parts[parts.length - 2], repo: parts[parts.length - 1], path: '' };
    }

    return {
      owner: match[1],
      repo: match[2],
      branch: match[3],
      path: match[4] || ''
    };
  }

  private async getRepoContentRecursive(owner: string, repo: string, path: string, branch?: string): Promise<string> {
    let contentAccumulator = "";
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const githubToken = this.configService.get<string>('GITHUB_TOKEN');

    const headers: any = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'NestJS-PoC-App'
    };
    if (githubToken) headers['Authorization'] = `token ${githubToken}`;

    const params: any = {};
    if (branch) params.ref = branch;

    try {
      const response = await axios.get(apiUrl, { headers, params });
      const items = response.data;

      if (!Array.isArray(items)) {
        if (items.type === 'file' && this.isCodeFile(items.name)) {
          const fileContent = await this.downloadRawFile(items.download_url);
          return `\n\n--- FILE: ${items.path} ---\n${fileContent}`;
        }
        return "";
      }

      for (const item of items) {
        if (item.type === 'file') {
          if (this.isCodeFile(item.name)) {
            const fileContent = await this.downloadRawFile(item.download_url);
            contentAccumulator += `\n\n--- FILE: ${item.path} ---\n${fileContent}`;
          }
        } else if (item.type === 'dir') {
          contentAccumulator += await this.getRepoContentRecursive(owner, repo, item.path, branch);
        }
      }
    } catch (error) {
      console.error(`Warning: Saltata cartella/file ${path} - ${error.message}`);
    }
    return contentAccumulator;
  }

  private async downloadRawFile(url: string): Promise<string> {
    try {
      const response = await axios.get(url);
      if (typeof response.data === 'object') return JSON.stringify(response.data, null, 2);
      return response.data;
    } catch (e) { return ""; }
  }

  private isCodeFile(filename: string): boolean {
    const validExtensions = ['.ts', '.js', '.tsx', '.jsx', '.c', '.cpp', '.h', '.hpp', '.py', '.java', '.md', '.txt', '.json', '.css', '.html', '.go', '.rs', '.php', '.typ'];
    return validExtensions.some(ext => filename.endsWith(ext));
  }

  async getAllSummaries() {
    return this.summaryModel.find().sort({ createdAt: -1 }).exec();
  }
}