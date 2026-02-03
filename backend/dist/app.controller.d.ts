import { MessageEvent } from '@nestjs/common';
import { AppService } from './app.service';
import { Observable } from 'rxjs';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    analyzeStream(url: string): Observable<MessageEvent>;
    getHistory(): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/summary.schema").RepoSummary, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/summary.schema").RepoSummary & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    })[]>;
    deleteRepo(id: string): Promise<void>;
}
