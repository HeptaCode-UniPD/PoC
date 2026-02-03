import { Controller, Get, Sse, Query, Delete, Param, MessageEvent } from '@nestjs/common';
import { AppService } from './app.service';
import { Observable } from 'rxjs';


// Arrivata la richiesta http al server nest, la tabella di routing creata inoltra la richiesta POST o GET in base ai percorsi definiti qui
@Controller('repo') // Prefisso URL: http://localhost:3000/repo
export class AppController {
  
  constructor(private readonly appService: AppService) {}

  @Sse('analyze/stream')
  analyzeStream(@Query('url') url: string): Observable<MessageEvent> {
    // Nota: Passiamo l'URL come query param perché EventSource nativo supporta solo GET
    return this.appService.analyzeStream(url);
  }

  @Get('history') //Per una richiesta curl http://localhost:3000/repo/history
  async getHistory() {
    return await this.appService.getAllSummaries();
  }

  @Delete(':id')
  async deleteRepo(@Param('id') id: string) {
    return await this.appService.deleteSummary(id);
  }
}