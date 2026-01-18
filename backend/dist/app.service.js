"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
const axios_1 = __importDefault(require("axios"));
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
let AppService = class AppService {
    summaryModel;
    configService;
    bedrockClient;
    constructor(summaryModel, configService) {
        this.summaryModel = summaryModel;
        this.configService = configService;
        const region = this.configService.get('AWS_REGION') || 'us-east-1';
        const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
        const sessionToken = this.configService.get('AWS_SESSION_TOKEN');
        const clientConfig = { region };
        if (accessKeyId && secretAccessKey) {
            clientConfig.credentials = {
                accessKeyId,
                secretAccessKey,
                ...(sessionToken && { sessionToken })
            };
        }
        this.bedrockClient = new client_bedrock_runtime_1.BedrockRuntimeClient(clientConfig);
    }
    async analyzeAndSave(repoUrl) {
        const { owner, repo } = this.parseGithubUrl(repoUrl);
        let combinedText = "";
        try {
            combinedText = await this.getRepoContentRecursive(owner, repo, '');
        }
        catch (e) {
            console.error(`Errore scaricando la repo ${owner}/${repo}:`, e.message);
            throw new common_1.HttpException('Impossibile scaricare la repository', common_1.HttpStatus.BAD_REQUEST);
        }
        if (!combinedText) {
            return "Nessun file di codice analizzabile trovato nella repo.";
        }
        const truncatedText = combinedText.slice(0, 30000);
        const prompt = `
  Sei un Tech Lead esperto. Analizza il codice sorgente fornito e genera un report tecnico strutturato in Markdown.
  Segui rigorosamente questo schema:

  # 📦 [Nome Repository]
  **Scopo**: Una frase concisa sull'obiettivo del progetto.

  ## 🛠 Stack Tecnologico
  * Elenco puntato dei linguaggi/framework principali rilevati.

  ## 🏗 Architettura
  Descrivi brevemente come è organizzato il codice (es. Monolite, Microservizi, Struttura cartelle).

  ## 🔑 Funzionalità Chiave
  1. **Feature 1**: Descrizione.
  2. **Feature 2**: Descrizione.

  ## ⚖️ Valutazione
  * **Punti di forza**: ...
  * **Aree di miglioramento**: ...

  Sii sintetico e rendi la lettura facilmente comprensibile.
  Ecco il codice (troncato ai primi 30k caratteri):
  \n\n${truncatedText}`;
        const userMessage = `Ecco il codice da analizzare:\n${truncatedText}`;
        const payload = {
            system: [{ text: prompt }],
            messages: [
                {
                    role: "user",
                    content: [{ text: userMessage }]
                }
            ],
            inferenceConfig: {
                max_new_tokens: 2000,
                temperature: 0.3,
                top_p: 0.9
            }
        };
        console.log("--- DEBUG BEDROCK (NOVA) ---");
        console.log("Modello:", "us.amazon.nova-micro-v1:0");
        try {
            const command = new client_bedrock_runtime_1.InvokeModelCommand({
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
        }
        catch (error) {
            console.error("Errore AWS Bedrock:", error);
            throw new common_1.HttpException("Errore durante l'analisi AI con AWS", common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    parseGithubUrl(url) {
        const cleanUrl = url.replace(/\/$/, "");
        const parts = cleanUrl.split('/');
        return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
    }
    async getRepoContentRecursive(owner, repo, path) {
        let contentAccumulator = "";
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const githubToken = this.configService.get('GITHUB_TOKEN');
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'NestJS-PoC-App'
        };
        if (githubToken) {
            headers['Authorization'] = `token ${githubToken}`;
        }
        try {
            const response = await axios_1.default.get(apiUrl, { headers });
            const items = response.data;
            if (!Array.isArray(items))
                return "";
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
    async downloadRawFile(url) {
        try {
            const response = await axios_1.default.get(url);
            if (typeof response.data === 'object') {
                return JSON.stringify(response.data, null, 2);
            }
            return response.data;
        }
        catch (e) {
            return "";
        }
    }
    isCodeFile(filename) {
        const validExtensions = ['.ts', '.js', '.c', '.cpp', '.h', '.hpp', '.py', '.java', '.md', '.txt', '.json'];
        return validExtensions.some(ext => filename.endsWith(ext));
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