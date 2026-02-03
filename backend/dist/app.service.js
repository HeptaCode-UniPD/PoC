"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const summary_schema_1 = require("./schemas/summary.schema");
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const simple_git_1 = __importDefault(require("simple-git"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto_1 = require("crypto");
const rxjs_1 = require("rxjs");
let AppService = class AppService {
    summaryModel;
    configService;
    bedrockClient;
    MAX_CONTEXT_CHARS = 300000;
    constructor(summaryModel, configService) {
        this.summaryModel = summaryModel;
        this.configService = configService;
        const keyCheck = this.configService.get('AWS_ACCESS_KEY_ID');
        console.log("Access Key letta:", keyCheck ? "SÌ" : "NO");
        console.log("Regione:", this.configService.get('AWS_REGION'));
        const region = this.configService.get('AWS_REGION') || 'us-east-1';
        const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
        const sessionToken = this.configService.get('AWS_SESSION_TOKEN');
        const clientConfig = { region };
        if (accessKeyId && secretAccessKey) {
            clientConfig.credentials = { accessKeyId, secretAccessKey, ...(sessionToken && { sessionToken }) };
        }
        this.bedrockClient = new client_bedrock_runtime_1.BedrockRuntimeClient(clientConfig);
    }
    analyzeStream(repoUrl) {
        return new rxjs_1.Observable((observer) => {
            const execute = async () => {
                const tempDir = path.join(os.tmpdir(), 'repo-summarizer', (0, crypto_1.randomUUID)());
                try {
                    observer.next({ data: { type: 'status', message: 'Avvio processo...' } });
                    console.log(`Avvio audit per: ${repoUrl}`);
                    await fs.ensureDir(tempDir);
                    const git = (0, simple_git_1.default)();
                    observer.next({ data: { type: 'status', message: 'Clonazione repository...' } });
                    await git.clone(repoUrl, tempDir, ['--depth', '1']);
                    observer.next({ data: { type: 'status', message: 'Lettura e filtraggio file...' } });
                    const combinedText = await this.readRepoFilesSmart(tempDir);
                    if (!combinedText || combinedText.length < 50) {
                        throw new Error('Repository vuota o nessun file valido trovato.');
                    }
                    observer.next({ data: { type: 'status', message: 'Analisi AI, potrebbe richiedere tempo...' } });
                    const summaryText = await this.callBedrockNova(combinedText, repoUrl);
                    observer.next({ data: { type: 'status', message: 'Salvataggio risultati...' } });
                    const createdSummary = new this.summaryModel({
                        repoUrl: repoUrl,
                        summaryText: summaryText
                    });
                    const savedDoc = await createdSummary.save();
                    observer.next({ data: { type: 'result', payload: savedDoc } });
                    observer.complete();
                }
                catch (e) {
                    console.error("Errore pipeline:", e);
                    observer.next({ data: { type: 'error', message: e.message } });
                    observer.complete();
                }
                finally {
                    try {
                        await fs.remove(tempDir);
                    }
                    catch (cleanupErr) {
                        console.error("Errore pulizia:", cleanupErr);
                    }
                }
            };
            execute();
        });
    }
    async deleteSummary(id) {
        const result = await this.summaryModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new common_1.NotFoundException(`Analisi con ID ${id} non trovata`);
        }
    }
    async readRepoFilesSmart(dirPath) {
        const validExtensions = new Set([
            '.md', '.txt', '.typ', '.rst', '.adoc', '.pdf', '.html',
            '.json', '.yml', '.yaml', '.toml',
            '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.h',
            '.cs', '.go', '.rs', '.php', '.rb', '.css'
        ]);
        const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'vendor', 'bin', 'obj']);
        let accumulatedText = "";
        let totalChars = 0;
        const traverse = async (currentPath) => {
            if (totalChars >= this.MAX_CONTEXT_CHARS)
                return;
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            const files = entries.filter(e => e.isFile()).sort((a, b) => a.name.localeCompare(b.name));
            const dirs = entries.filter(e => e.isDirectory() && !ignoreDirs.has(e.name));
            for (const entry of files) {
                if (totalChars >= this.MAX_CONTEXT_CHARS)
                    return;
                const ext = path.extname(entry.name).toLowerCase();
                if (!validExtensions.has(ext) || entry.name.includes('lock'))
                    continue;
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
                }
                catch (readErr) {
                    console.warn(`Impossibile leggere ${fullPath}:`, readErr.message);
                }
            }
            for (const dir of dirs) {
                if (totalChars >= this.MAX_CONTEXT_CHARS)
                    return;
                await traverse(path.join(currentPath, dir.name));
            }
        };
        await traverse(dirPath);
        console.log(`Totale caratteri estratti: ${totalChars} / ${this.MAX_CONTEXT_CHARS}`);
        return accumulatedText;
    }
    async callBedrockNova(codeContext, repoUrl) {
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
        const command = new client_bedrock_runtime_1.InvokeModelCommand({
            modelId: "eu.amazon.nova-micro-v1:0",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(payload),
        });
        const response = await this.bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        return responseBody.output.message.content[0].text;
    }
    async getAllSummaries() {
        return this.summaryModel.find().sort({ createdAt: -1 }).exec();
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(summary_schema_1.RepoSummary.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        config_1.ConfigService])
], AppService);
//# sourceMappingURL=app.service.js.map