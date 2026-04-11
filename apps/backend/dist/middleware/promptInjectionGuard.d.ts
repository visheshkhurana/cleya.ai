import { Request, Response, NextFunction } from 'express';
interface ScanResult {
    blocked: boolean;
    reason?: string;
}
declare function scanForInjection(text: string): ScanResult;
export declare function promptInjectionGuard(req: Request, res: Response, next: NextFunction): void;
export { scanForInjection };
//# sourceMappingURL=promptInjectionGuard.d.ts.map