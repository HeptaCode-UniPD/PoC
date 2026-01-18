import { Controller, Post, Get, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { AnalyzeRepoDto } from './dto/analyze-repo.dto';


// Arrivata la richiesta http al server nest, la tabella di routing creata inoltra la richiesta POST o GET in base ai percorsi definiti qui
@Controller('repo') // Prefisso URL: http://localhost:3000/repo
export class AppController {
  
  constructor(private readonly appService: AppService) {}

  @Post('analyze') // Per una richiesta curl -X POST http://localhost:3000/repo/analyze ...
  
  async analyze(@Body() body: AnalyzeRepoDto) {  // Il decoratore @Body() serve ad estrarre il payload (che dev'essere un oggetto che rispetta la struttura di AnalyzeRepoDto)
                                                // della richiesta http in formato JSON, come comunicato nell'header della richiesta http "Content-Type: application/json"

    return await this.appService.analyzeAndSave(body.repoUrl);  // Qui isoliamo la stringa URL e la passiamo alla funzione del service per rispettare analyzeAndSave(repoUrl: string).
  }

  @Get('history') //Per una richiesta curl http://localhost:3000/repo/history
  async getHistory() {
    return await this.appService.getAllSummaries();
  }
}