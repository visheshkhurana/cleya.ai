import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth';
import { fileUploadValidation } from '../middleware/fileValidation';
import {
  saveUploadedFile,
  getFileById,
  getFilesByCreator,
  getRecentFiles,
  getFilePath,
  deleteFile,
  FileRecord,
} from '../services/fileService';
import fs from 'fs';

export const filesRouter = Router();

const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_UPLOAD_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

filesRouter.post(
  '/upload',
  authenticate,
  requireRole('MANAGER'),
  upload.single('file'),
  fileUploadValidation({ allowedTypes: ALLOWED_UPLOAD_TYPES }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ success: false, error: { message: 'No file provided' } });
        return;
      }

      const userId = (req as any).user?.userId || 'unknown';
      const description = req.body?.description || '';
      const category = req.body?.category || 'upload';

      const record = await saveUploadedFile(file, userId, 'user', description, category);

      res.json({
        success: true,
        data: {
          fileId: record.file_id,
          originalName: record.original_name,
          mimeType: record.mime_type,
          sizeBytes: record.size_bytes,
          category: record.category,
          createdAt: record.created_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

filesRouter.get(
  '/download/:fileId',
  authenticate,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await getFileById(req.params.fileId);
      if (!record) {
        res.status(404).json({ success: false, error: { message: 'File not found' } });
        return;
      }

      const filePath = getFilePath(record.stored_name);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ success: false, error: { message: 'File not found on disk' } });
        return;
      }

      res.setHeader('Content-Type', record.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.original_name)}"`);
      res.setHeader('Content-Length', record.size_bytes.toString());
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      next(error);
    }
  }
);

filesRouter.get(
  '/view/:fileId',
  authenticate,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await getFileById(req.params.fileId);
      if (!record) {
        res.status(404).json({ success: false, error: { message: 'File not found' } });
        return;
      }

      const filePath = getFilePath(record.stored_name);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ success: false, error: { message: 'File not found on disk' } });
        return;
      }

      res.setHeader('Content-Type', record.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(record.original_name)}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      next(error);
    }
  }
);

filesRouter.get(
  '/list',
  authenticate,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const creator = req.query.creator as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      let files: FileRecord[];
      if (creator) {
        files = await getFilesByCreator(creator, limit);
      } else {
        files = await getRecentFiles(limit);
      }

      res.json({
        success: true,
        data: files.map(f => ({
          fileId: f.file_id,
          originalName: f.original_name,
          mimeType: f.mime_type,
          sizeBytes: f.size_bytes,
          category: f.category,
          createdBy: f.created_by,
          createdByType: f.created_by_type,
          description: f.description,
          createdAt: f.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

filesRouter.delete(
  '/:fileId',
  authenticate,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deleted = await deleteFile(req.params.fileId);
      if (!deleted) {
        res.status(404).json({ success: false, error: { message: 'File not found' } });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);
