import { Request, Response, NextFunction } from 'express';

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
}

const MAGIC_BYTES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  'image/gif': [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
  'image/webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])],
  'application/pdf': [Buffer.from('%PDF')],
  'image/svg+xml': [],
};

const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

export function validateFileContent(
  buffer: Buffer,
  declaredType: string
): boolean {
  const magicPatterns = MAGIC_BYTES[declaredType];

  if (!magicPatterns || magicPatterns.length === 0) {
    return ALLOWED_UPLOAD_TYPES.has(declaredType);
  }

  if (declaredType === 'image/webp') {
    if (buffer.length < 12) return false;
    const riff = buffer.subarray(0, 4).equals(Buffer.from([0x52, 0x49, 0x46, 0x46]));
    const webp = buffer.subarray(8, 12).equals(Buffer.from('WEBP'));
    return riff && webp;
  }

  return magicPatterns.some(pattern =>
    buffer.length >= pattern.length &&
    buffer.subarray(0, pattern.length).equals(pattern)
  );
}

export function fileUploadValidation(options: {
  maxFileSize?: number;
  allowedTypes?: Set<string>;
} = {}) {
  const maxSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const allowedTypes = options.allowedTypes ?? ALLOWED_UPLOAD_TYPES;

  return (req: Request, res: Response, next: NextFunction) => {
    const anyReq = req as any;
    const file: UploadedFile | undefined = anyReq.file;
    const filesRaw: UploadedFile[] | Record<string, UploadedFile[]> | undefined = anyReq.files;

    if (!file && !filesRaw) {
      next();
      return;
    }

    let files: UploadedFile[];
    if (file) {
      files = [file];
    } else if (Array.isArray(filesRaw)) {
      files = filesRaw;
    } else if (filesRaw && typeof filesRaw === 'object') {
      files = Object.values(filesRaw as Record<string, UploadedFile[]>).flat();
    } else {
      files = [];
    }

    for (const f of files) {
      if (f.size > maxSize) {
        res.status(413).json({
          success: false,
          error: { message: `File ${f.originalname} exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB` },
        });
        return;
      }

      if (!allowedTypes.has(f.mimetype)) {
        res.status(400).json({
          success: false,
          error: { message: `File type ${f.mimetype} is not allowed` },
        });
        return;
      }

      if (f.buffer && !validateFileContent(f.buffer, f.mimetype)) {
        res.status(400).json({
          success: false,
          error: { message: `File ${f.originalname} content does not match declared type ${f.mimetype}` },
        });
        return;
      }
    }

    next();
  };
}
