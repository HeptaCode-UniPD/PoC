import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { RepoSummary } from './schemas/summary.schema';
import { Observable } from 'rxjs';
export declare class AppService {
    private summaryModel;
    private configService;
    private bedrockClient;
    private readonly MAX_CONTEXT_CHARS;
    constructor(summaryModel: Model<RepoSummary>, configService: ConfigService);
    analyzeStream(repoUrl: string): Observable<any>;
    deleteSummary(id: string): Promise<void>;
    private readRepoFilesSmart;
    private callBedrockNova;
    getAllSummaries(): Promise<(import("mongoose").Document<unknown, {}, RepoSummary, {}, import("mongoose").DefaultSchemaOptions> & RepoSummary & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    })[]>;
}
