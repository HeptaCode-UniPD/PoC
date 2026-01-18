export declare class RepoSummary {
    repoUrl: string;
    summaryText: string;
    createdAt: Date;
}
export declare const RepoSummarySchema: import("mongoose").Schema<RepoSummary, import("mongoose").Model<RepoSummary, any, any, any, (import("mongoose").Document<unknown, any, RepoSummary, any, import("mongoose").DefaultSchemaOptions> & RepoSummary & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
} & {
    id: string;
}) | (import("mongoose").Document<unknown, any, RepoSummary, any, import("mongoose").DefaultSchemaOptions> & RepoSummary & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}), any, RepoSummary>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, RepoSummary, import("mongoose").Document<unknown, {}, RepoSummary, {
    id: string;
}, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<RepoSummary & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    repoUrl?: import("mongoose").SchemaDefinitionProperty<string, RepoSummary, import("mongoose").Document<unknown, {}, RepoSummary, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<RepoSummary & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    summaryText?: import("mongoose").SchemaDefinitionProperty<string, RepoSummary, import("mongoose").Document<unknown, {}, RepoSummary, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<RepoSummary & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    createdAt?: import("mongoose").SchemaDefinitionProperty<Date, RepoSummary, import("mongoose").Document<unknown, {}, RepoSummary, {
        id: string;
    }, import("mongoose").ResolveSchemaOptions<import("mongoose").DefaultSchemaOptions>> & Omit<RepoSummary & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, RepoSummary>;
