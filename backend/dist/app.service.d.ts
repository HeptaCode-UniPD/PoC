import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { RepoSummary } from './schemas/summary.schema';
export declare class AppService {
    private summaryModel;
    private configService;
    private bedrockClient;
    constructor(summaryModel: Model<RepoSummary>, configService: ConfigService);
    analyzeAndSave(repoUrl: string): Promise<any>;
    private parseGithubUrl;
    private getRepoContentRecursive;
    private downloadRawFile;
    private isCodeFile;
    getAllSummaries(): Promise<(import("mongoose").Document<unknown, {}, RepoSummary, {}, import("mongoose").DefaultSchemaOptions> & RepoSummary & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    })[]>;
}
