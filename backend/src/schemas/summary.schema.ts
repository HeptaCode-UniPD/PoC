import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

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