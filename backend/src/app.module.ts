import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; 
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RepoSummary, RepoSummarySchema } from './schemas/summary.schema';

// Questo è il "Linker", dice a NestJS quali pezzi assemblare all'avvio.
@Module({
  // Qui carichiamo le librerie esterne o altri moduli
  imports: [
    // Carica il file .env in memoria all'avvio. 
    // isGlobal: true evita di doverlo re-importare in ogni singolo file del progetto.
    ConfigModule.forRoot({ isGlobal: true }), 
    
    // Apre la connessione fisica al server del Database.
    // Usa la variabile d'ambiente o fallbacks su localhost se non la trova.
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost/repo-summarizer'),
    
    // Insegna a NestJS che esiste una "tabella" chiamata RepoSummary.
    // Senza questa riga, l'iniezione "@InjectModel" nel costruttore del Service fallirebbe (Linker Error).
    MongooseModule.forFeature([{ name: RepoSummary.name, schema: RepoSummarySchema }])
  ],

  // Dice a NestJS: "Controlla questa classe per trovare i percorsi URL (@Post, @Get)".
  controllers: [AppController],

  // Dice a NestJS: "Se qualcuno chiede AppService nel costruttore, tu crea un'istanza di questa classe e passagliela".
  providers: [AppService],
})
export class AppModule {}