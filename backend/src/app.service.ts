import { Injectable, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
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
import { Observable } from 'rxjs';

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

    // --- DEBUG ---
  const keyCheck = this.configService.get<string>('AWS_ACCESS_KEY_ID');
  console.log("Access Key letta:", keyCheck ? "SÌ" : "NO");
  console.log("Regione:", this.configService.get<string>('AWS_REGION'));
  // --- FINE ---

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

  analyzeStream(repoUrl: string): Observable<any> {
    return new Observable((observer) => {
      const execute = async () => {
        const tempDir = path.join(os.tmpdir(), 'repo-summarizer', randomUUID());
        
        try {
          // STEP 1: Avvio
          observer.next({ data: { type: 'status', message: 'Avvio processo...' } });
          console.log(`Avvio audit per: ${repoUrl}`);

          // STEP 2: Clonazione
          await fs.ensureDir(tempDir);
          const git = simpleGit();
          observer.next({ data: { type: 'status', message: 'Clonazione repository...' } });
          await git.clone(repoUrl, tempDir, ['--depth', '1']);

          // STEP 3: Lettura File
          observer.next({ data: { type: 'status', message: 'Lettura e filtraggio file...' } });
          const combinedText = await this.readRepoFilesSmart(tempDir);
          
          if (!combinedText || combinedText.length < 50) {
            throw new Error('Repository vuota o nessun file valido trovato.');
          }

          // STEP 4: AI
          observer.next({ data: { type: 'status', message: 'Analisi AI, potrebbe richiedere tempo...' } });
          const summaryText = await this.callBedrockNova(combinedText, repoUrl);

          // STEP 5: Salvataggio
          observer.next({ data: { type: 'status', message: 'Salvataggio risultati...' } });
          const createdSummary = new this.summaryModel({
            repoUrl: repoUrl,
            summaryText: summaryText
          });
          const savedDoc = await createdSummary.save();

          // COMPLETAMENTO: Inviamo l'oggetto finale
          observer.next({ data: { type: 'result', payload: savedDoc } });
          observer.complete();

        } catch (e) {
          console.error("Errore pipeline:", e);
          // Inviamo l'errore al client via SSE
          observer.next({ data: { type: 'error', message: e.message } });
          observer.complete(); // Chiudiamo lo stream anche in caso di errore gestito
        } finally {
          try {
            await fs.remove(tempDir);
          } catch (cleanupErr) {
            console.error("Errore pulizia:", cleanupErr);
          }
        }
      };

      execute();
    });
  }

  async deleteSummary(id: string): Promise<void> {
    const result = await this.summaryModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Analisi con ID ${id} non trovata`);
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
    const systemPrompt = `Sei un Senior Technical Writer e Developer Advocate con anni di esperienza nell'analisi di progetti Open Source.
Il tuo compito è eseguire un **Audit Documentale Puro** del repository: ${repoUrl}.

**OBIETTIVO**
Valutare ESCLUSIVAMENTE l'adeguatezza, la chiarezza e la completezza della documentazione.
NON giudicare la qualità tecnica del codice (clean code, performance, pattern) a meno che l'assenza di commenti non renda il codice incomprensibile.

**ISTRUZIONI DI CONTESTO (Analisi del Tipo)**
Prima di scrivere, identifica la natura del progetto dai file (README, package.json, ecc.) per adattare i criteri di giudizio:
1. **LIBRERIA/FRAMEWORK**: Serve documentazione API, esempi di utilizzo immediato, installazione chiara.
2. **APP END-USER**: Servono istruzioni di deploy, configurazione (.env), architettura.
3. **TOOL/CLI**: Serve una lista comandi, flag supportati, esempi di input/output.

Genera un report Markdown seguendo rigorosamente questo schema:

# 📄 Audit Documentazione: ${repoUrl}
**Tipologia Progetto**: (es. "Libreria React", "Backend NestJS", ecc.)
**Giudizio Sintetico**: Una singola frase incisiva sullo stato della documentazione.

## 🟢 Cosa Funziona 
In questa sezione, scrivi 1 o 2 paragrafi discorsivi (NON usare elenchi puntati).
Analizza cosa rende l'onboarding facile. Spiega *perché* la documentazione è efficace.
*Esempio: "La documentazione eccelle nella guida introduttiva. Il README guida l'utente passo dopo passo dall'installazione al primo utilizzo senza dare nulla per scontato..."*

## 🔴 Cosa Manca o Non Funziona 
In questa sezione, scrivi 1 o 2 paragrafi discorsivi (NON usare elenchi puntati).
Argomenta le lacune che bloccherebbero un nuovo sviluppatore. Sii specifico: cita nomi di file o sezioni mancanti.
*Esempio: "La criticità maggiore risiede nella mancanza di spiegazioni per la configurazione. Sebbene sia presente un file .env.example, non esiste una guida che spieghi dove recuperare quelle chiavi API..."*

## 🛠 Azioni Raccomandate
Qui usa un elenco puntato sintetico per i suggerimenti pratici:
* [Priorità Alta] Azione da fare subito (es. "Creare sezione Contributing").
* [Priorità Media] Azione di miglioramento (es. "Aggiungere commenti JSDoc a feature X").

Sii professionale, costruttivo e focalizzato sull'esperienza dello sviluppatore (DX). Usa l'italiano.`;

    const userMessage = `Ecco i file di documentazione e sorgente da analizzare:\n\n${codeContext}`;

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

  /**
   * Recupera tutti i riassunti dal database ordinati per data (dal più recente)
   */
  async getAllSummaries() {
    return this.summaryModel.find().sort({ createdAt: -1 }).exec();
  }
}