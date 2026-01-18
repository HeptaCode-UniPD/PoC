import { AppService } from './app.service';
import { AnalyzeRepoDto } from './dto/analyze-repo.dto';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    analyze(body: AnalyzeRepoDto): Promise<any>;
    getHistory(): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/summary.schema").RepoSummary, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/summary.schema").RepoSummary & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    })[]>;
}
