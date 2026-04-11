"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.filesRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const fileValidation_1 = require("../middleware/fileValidation");
const fileService_1 = require("../services/fileService");
const fs_1 = __importDefault(require("fs"));
exports.filesRouter = (0, express_1.Router)();
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
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_UPLOAD_TYPES.has(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`File type ${file.mimetype} is not allowed`));
        }
    },
});
exports.filesRouter.post('/upload', auth_1.authenticate, (0, auth_1.requireRole)('MANAGER'), upload.single('file'), (0, fileValidation_1.fileUploadValidation)({ allowedTypes: ALLOWED_UPLOAD_TYPES }), async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            res.status(400).json({ success: false, error: { message: 'No file provided' } });
            return;
        }
        const userId = req.user?.userId || 'unknown';
        const description = req.body?.description || '';
        const category = req.body?.category || 'upload';
        const record = await (0, fileService_1.saveUploadedFile)(file, userId, 'user', description, category);
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
    }
    catch (error) {
        next(error);
    }
});
exports.filesRouter.get('/download/:fileId', auth_1.authenticate, (0, auth_1.requireRole)('MANAGER'), async (req, res, next) => {
    try {
        const record = await (0, fileService_1.getFileById)(req.params.fileId);
        if (!record) {
            res.status(404).json({ success: false, error: { message: 'File not found' } });
            return;
        }
        const filePath = (0, fileService_1.getFilePath)(record.stored_name);
        if (!fs_1.default.existsSync(filePath)) {
            res.status(404).json({ success: false, error: { message: 'File not found on disk' } });
            return;
        }
        res.setHeader('Content-Type', record.mime_type);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.original_name)}"`);
        res.setHeader('Content-Length', record.size_bytes.toString());
        fs_1.default.createReadStream(filePath).pipe(res);
    }
    catch (error) {
        next(error);
    }
});
exports.filesRouter.get('/view/:fileId', auth_1.authenticate, (0, auth_1.requireRole)('MANAGER'), async (req, res, next) => {
    try {
        const record = await (0, fileService_1.getFileById)(req.params.fileId);
        if (!record) {
            res.status(404).json({ success: false, error: { message: 'File not found' } });
            return;
        }
        const filePath = (0, fileService_1.getFilePath)(record.stored_name);
        if (!fs_1.default.existsSync(filePath)) {
            res.status(404).json({ success: false, error: { message: 'File not found on disk' } });
            return;
        }
        res.setHeader('Content-Type', record.mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(record.original_name)}"`);
        fs_1.default.createReadStream(filePath).pipe(res);
    }
    catch (error) {
        next(error);
    }
});
exports.filesRouter.get('/list', auth_1.authenticate, (0, auth_1.requireRole)('MANAGER'), async (req, res, next) => {
    try {
        const creator = req.query.creator;
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        let files;
        if (creator) {
            files = await (0, fileService_1.getFilesByCreator)(creator, limit);
        }
        else {
            files = await (0, fileService_1.getRecentFiles)(limit);
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
    }
    catch (error) {
        next(error);
    }
});
exports.filesRouter.delete('/:fileId', auth_1.authenticate, (0, auth_1.requireRole)('ADMIN'), async (req, res, next) => {
    try {
        const deleted = await (0, fileService_1.deleteFile)(req.params.fileId);
        if (!deleted) {
            res.status(404).json({ success: false, error: { message: 'File not found' } });
            return;
        }
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=files.js.map