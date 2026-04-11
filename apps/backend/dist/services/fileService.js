"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveUploadedFile = saveUploadedFile;
exports.createFileFromContent = createFileFromContent;
exports.getFileById = getFileById;
exports.getFilesByCreator = getFilesByCreator;
exports.getRecentFiles = getRecentFiles;
exports.getFilePath = getFilePath;
exports.deleteFile = deleteFile;
exports.getMimeType = getMimeType;
const db_1 = require("@cleya/db");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const UPLOADS_DIR = path_1.default.join(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(UPLOADS_DIR)) {
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
async function saveUploadedFile(file, createdBy, createdByType, description = '', category = 'upload', metadata = {}) {
    const fileId = crypto_1.default.randomUUID();
    const ext = path_1.default.extname(file.originalname) || '';
    const storedName = `${fileId}${ext}`;
    const filePath = path_1.default.join(UPLOADS_DIR, storedName);
    fs_1.default.writeFileSync(filePath, file.buffer);
    const rows = await db_1.prisma.$queryRawUnsafe(`
    INSERT INTO dm_files (file_id, original_name, stored_name, mime_type, size_bytes, category, created_by, created_by_type, description, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, fileId, file.originalname, storedName, file.mimetype, file.size, category, createdBy, createdByType, description, JSON.stringify(metadata));
    return rows[0];
}
async function createFileFromContent(content, filename, mimeType, createdBy, createdByType, description = '', category = 'generated', metadata = {}) {
    const fileId = crypto_1.default.randomUUID();
    const ext = path_1.default.extname(filename) || '';
    const storedName = `${fileId}${ext}`;
    const filePath = path_1.default.join(UPLOADS_DIR, storedName);
    const buffer = Buffer.from(content, 'utf-8');
    fs_1.default.writeFileSync(filePath, buffer);
    const rows = await db_1.prisma.$queryRawUnsafe(`
    INSERT INTO dm_files (file_id, original_name, stored_name, mime_type, size_bytes, category, created_by, created_by_type, description, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, fileId, filename, storedName, mimeType, buffer.length, category, createdBy, createdByType, description, JSON.stringify(metadata));
    return rows[0];
}
async function getFileById(fileId) {
    const rows = await db_1.prisma.$queryRawUnsafe(`SELECT * FROM dm_files WHERE file_id = $1`, fileId);
    return rows[0] || null;
}
async function getFilesByCreator(createdBy, limit = 50) {
    return db_1.prisma.$queryRawUnsafe(`SELECT * FROM dm_files WHERE created_by = $1 ORDER BY created_at DESC LIMIT $2`, createdBy, limit);
}
async function getRecentFiles(limit = 50) {
    return db_1.prisma.$queryRawUnsafe(`SELECT * FROM dm_files ORDER BY created_at DESC LIMIT $1`, limit);
}
function getFilePath(storedName) {
    return path_1.default.join(UPLOADS_DIR, storedName);
}
async function deleteFile(fileId) {
    const file = await getFileById(fileId);
    if (!file)
        return false;
    const filePath = path_1.default.join(UPLOADS_DIR, file.stored_name);
    if (fs_1.default.existsSync(filePath)) {
        fs_1.default.unlinkSync(filePath);
    }
    await db_1.prisma.$executeRawUnsafe(`DELETE FROM dm_files WHERE file_id = $1`, fileId);
    return true;
}
const MIME_MAP = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.html': 'text/html',
    '.xml': 'application/xml',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
};
function getMimeType(filename) {
    const ext = path_1.default.extname(filename).toLowerCase();
    return MIME_MAP[ext] || 'application/octet-stream';
}
//# sourceMappingURL=fileService.js.map