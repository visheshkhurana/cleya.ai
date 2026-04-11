import { Request, Response, NextFunction } from 'express';
export declare function verifyWebhookTimestamp(timestampHeader: string | undefined, toleranceMs?: number): boolean;
export declare function verifyHmacSignature(payload: string | Buffer, signature: string, secret: string, algorithm?: string): boolean;
export declare function webhookRawBodyParser(maxBytes?: number): import("connect").NextHandleFunction;
export declare function webhookPayloadSizeLimit(maxBytes?: number): (req: Request, res: Response, next: NextFunction) => void;
export declare function requireWebhookTimestamp(headerName: string): (req: Request, res: Response, next: NextFunction) => void;
export declare function getRawBody(req: Request): Buffer | undefined;
//# sourceMappingURL=webhookSecurity.d.ts.map