import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// Questo decoratore @Schema dice a NestJS che questa classe mappa una collection Mongo, definisce come i dati vengono salvati fisicamente dentro MongoDB.
@Schema()
export class RepoSummary {
  @Prop({ required: true }) 
  repoUrl: string;
  
  @Prop()
  summaryText: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const RepoSummarySchema = SchemaFactory.createForClass(RepoSummary);