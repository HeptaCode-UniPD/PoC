import { Controller, Post, Get, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { AnalyzeRepoDto } from './dto/analyze-repo.dto';


@Controller('repo')
export class AppController {
  
  constructor(private readonly appService: AppService) {}

  @Post('analyze')
  async analyze(@Body() body: AnalyzeRepoDto) { 
    return await this.appService.analyzeAndSave(body.repoUrl);  
  }

  @Get('history')
  async getHistory() {
    return await this.appService.getAllSummaries();
  }
}