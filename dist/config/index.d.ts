export declare const config: {
    readonly port: number;
    readonly nodeEnv: string;
    readonly db: {
        readonly url: string;
    };
    readonly redis: {
        readonly url: string;
    };
    readonly jwt: {
        readonly secret: string;
        readonly expiresIn: string;
    };
    readonly worker: {
        readonly concurrency: number;
        readonly pollTimeoutSeconds: number;
        readonly maxRetries: number;
        readonly heartbeatIntervalMs: 10000;
    };
    readonly webhook: {
        readonly secret: string;
        readonly timeoutMs: 10000;
    };
    readonly queue: {
        readonly highPriority: "tasks:high";
        readonly normalPriority: "tasks:normal";
        readonly lowPriority: "tasks:low";
        readonly deadLetter: "tasks:dead";
    };
};
//# sourceMappingURL=index.d.ts.map