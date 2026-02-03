import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

//Punto di inzio dell'applicazione.
async function bootstrap() {
  // Crea l'applicazione in maniera asincrona e fa partire uno scanner per mappare il percorso alle funzioni del controller, creando una tabella di routing
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const frontendUrl = configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

  app.enableCors({
    origin: frontendUrl,
    methods: 'GET,POST,DELETE,PUT,PATCH',
    allowedHeaders: 'Content-Type, Authorization',
  });

  const port = configService.get<number>('PORT') || 3000;
  //Fa in modo che l'app si metta in ascolto sulla porta assegnata (serve per aws) o come fallback sulla porta 3000, dove arriva la richiesta http
  await app.listen(port);
}
bootstrap();
