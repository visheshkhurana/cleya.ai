declare class Logger {
    private level;
    private service;
    private environment;
    constructor();
    private shouldLog;
    private formatMessage;
    error(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    debug(message: string, meta?: Record<string, unknown>): void;
    child(context: Record<string, unknown>): ChildLogger;
}
declare class ChildLogger {
    private parent;
    private context;
    constructor(parent: Logger, context: Record<string, unknown>);
    error(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    debug(message: string, meta?: Record<string, unknown>): void;
}
export declare const logger: Logger;
export { Logger, ChildLogger };
//# sourceMappingURL=logger.d.ts.map