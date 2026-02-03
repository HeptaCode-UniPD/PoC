import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RepoSummary } from './schemas/summary.schema';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import simpleGit from 'simple-git';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

@Injectable()
export class AppService {
  private bedrockClient: BedrockRuntimeClient;
  // Limite token/caratteri per Nova Micro (Input context window ~128k token).
  // Impostiamo un limite sicuro per lasciare spazio alla risposta.
  private readonly MAX_CONTEXT_CHARS = 300000; 

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
      clientConfig.credentials = { accessKeyId, secretAccessKey, ...(sessionToken && { sessionToken }) };
    }

    this.bedrockClient = new BedrockRuntimeClient(clientConfig);
  }

  async analyzeAndSave(repoUrl: string): Promise<RepoSummary> {
    const tempDir = path.join(os.tmpdir(), 'repo-summarizer', randomUUID());
    console.log(`Avvio audit documentazione per: ${repoUrl} in ${tempDir}`);

    try {
      // 1. CLONE --DEPTH 1 (Per velocità e risparmio banda)
      await fs.ensureDir(tempDir);
      const git = simpleGit();
      await git.clone(repoUrl, tempDir, ['--depth', '1']);

      // 2. LEGGI FILE (Priorità a docs e commenti codice)
      const combinedText = await this.readRepoFilesSmart(tempDir);
      
      if (!combinedText || combinedText.length < 50) {
        throw new HttpException('Repository vuota o nessun file di documentazione/codice trovato.', HttpStatus.BAD_REQUEST);
      }

      // 3. INVOCA BEDROCK (Con prompt QA/Technical Writing)
      const summaryText = await this.callBedrockNova(combinedText, repoUrl);

      // 4. SALVA
      const createdSummary = new this.summaryModel({
        repoUrl: repoUrl,
        summaryText: summaryText
      });

      return await createdSummary.save();

    } catch (e) {
      console.error("Errore pipeline:", e);
      throw new HttpException(
        e.message || "Errore durante l'analisi della repository", 
        e.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    } finally {
      // 5. CLEANUP
      try {
        await fs.remove(tempDir);
        console.log(`Pulizia completata: ${tempDir}`);
      } catch (cleanupErr) {
        console.error("Errore pulizia file temporanei:", cleanupErr);
      }
    }
  }

  private async readRepoFilesSmart(dirPath: string): Promise<string> {
    // Aggiunte estensioni specifiche per documentazione (.typ, .rst, .adoc)
    const validExtensions = new Set([
      // Docs
      '.md', '.txt', '.typ', '.rst', '.adoc', '.pdf', '.html',
      // Configs (utili per contesto)
      '.json', '.yml', '.yaml', '.toml',
      // Code (per verificare commenti)
      '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.h', 
      '.cs', '.go', '.rs', '.php', '.rb', '.css'
    ]);

    const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'vendor', 'bin', 'obj']);
    let accumulatedText = "";
    let totalChars = 0;

    const traverse = async (currentPath: string) => {
      if (totalChars >= this.MAX_CONTEXT_CHARS) return;

      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      // Ordiniamo: i file nella root corrente (README, ecc) hanno priorità
      const files = entries.filter(e => e.isFile()).sort((a,b) => a.name.localeCompare(b.name));
      const dirs = entries.filter(e => e.isDirectory() && !ignoreDirs.has(e.name));

      for (const entry of files) {
        if (totalChars >= this.MAX_CONTEXT_CHARS) return;

        const ext = path.extname(entry.name).toLowerCase();
        if (!validExtensions.has(ext) || entry.name.includes('lock')) continue;

        const fullPath = path.join(currentPath, entry.name);
        try {
            const content = await fs.readFile(fullPath, 'utf-8');
            
            const fileHeader = `\n\n--- FILE PATH: ${path.relative(dirPath, fullPath)} ---\n`;
            const entrySize = fileHeader.length + content.length;

            if (totalChars + entrySize > this.MAX_CONTEXT_CHARS) {
                if (totalChars < this.MAX_CONTEXT_CHARS * 0.1) {
                    const remaining = this.MAX_CONTEXT_CHARS - totalChars - fileHeader.length;
                    accumulatedText += fileHeader + content.slice(0, remaining) + "\n...[TRUNCATED DUE TO CONTEXT LIMIT]";
                    totalChars += entrySize;
                }
                return; 
            }

            accumulatedText += fileHeader + content;
            totalChars += entrySize;
        } catch (readErr) {
            console.warn(`Impossibile leggere ${fullPath}:`, readErr.message);
        }
      }

      for (const dir of dirs) {
        if (totalChars >= this.MAX_CONTEXT_CHARS) return;
        await traverse(path.join(currentPath, dir.name));
      }
    };

    await traverse(dirPath);
    console.log(`Totale caratteri estratti: ${totalChars} / ${this.MAX_CONTEXT_CHARS}`);
    return accumulatedText;
  }

  private async callBedrockNova(codeContext: string, repoUrl: string): Promise<string> {
    const systemPrompt = `Sei un QA Specialist ed esperto di Technical Writing.
Il tuo compito è eseguire una REVISIONE TECNICA (Audit) sulla documentazione fornita (file .typ, .md, txt) e sui commenti del codice per il repository ${repoUrl}.

Analizza il testo fornito cercando:
1. **Struttura**: Il documento segue un flusso logico?
2. **Completezza**: Mancano sezioni fondamentali per il tipo di documento (es. Requisiti senza attori, Codice senza commenti)?
3. **Chiarezza**: Ci sono ambiguità o frasi poco chiare sia nei commenti sia nella documentazione?
4. **Errori**: Potenziali incongruenze o errori di formattazione.

Genera un report rigoroso seguendo questo schema Markdown:

# 🕵️ Report di Revisione Documentale: ${repoUrl}
**Giudizio Sintetico**: (Es. "Documentazione solida ma incompleta" o "Ben strutturata").

## ✅ Analisi Qualitativa
* **Struttura e Formattazione**: Valutazione dell'organizzazione del contenuto.
* **Chiarezza Espositiva**: È comprensibile per il target di riferimento?
* **Coerenza**: I termini usati sono uniformi?
* **Rigore commenti**: I commenti utilizzati nel codice sono scritti in maniera consistente, utile e coerente?

## 🚩 Criticità Rilevate
* Elenco puntato di eventuali mancanze, errori logici, sezioni vuote o poco chiare.
* (Se non ci sono criticità, scrivi "Nessuna criticità rilevante").

## 💡 Suggerimenti di Miglioramento
* Consigli pratici su cosa aggiungere o riscrivere per migliorare la qualità del documento.

Sii costruttivo, professionale e usa l'italiano.`;

    const userMessage = `Ecco i documenti e il codice sorgente da revisionare:\n\n${codeContext}`;

    const payload = {
      system: [{ text: systemPrompt }],
      messages: [{ role: "user", content: [{ text: userMessage }] }],
      inferenceConfig: {
        max_new_tokens: 2500,
        temperature: 0.2,
        top_p: 0.9
      }
    };

    const command = new InvokeModelCommand({
      modelId: "eu.amazon.nova-micro-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await this.bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.output.message.content[0].text;
  }
}