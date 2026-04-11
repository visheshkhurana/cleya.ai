import { Request, Response, NextFunction } from 'express';
export declare function validateFileContent(buffer: Buffer, declaredType: string): boolean;
export declare function fileUploadValidation(options?: {
    maxFileSize?: number;
    allowedTypes?: Set<string>;
}): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=fileValidation.d.ts.map