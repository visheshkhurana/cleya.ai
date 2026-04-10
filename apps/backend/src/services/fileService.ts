import { prisma } from '@cleya/db';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface FileRecord {
  id: number;
  file_id: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  category: string;
  created_by: string;
  created_by_type: string;
  description: string;
  metadata: any;
  created_at: Date;
}

export async function saveUploadedFile(
  file: Express.Multer.File,
  createdBy: string,
  createdByType: 'user' | 'agent',
  description: string = '',
  category: string = 'upload',
  metadata: Record<string, any> = {}
): Promise<FileRecord> {
  const fileId = crypto.randomUUID();
  const ext = path.extname(file.originalname) || '';
  const storedName = `${fileId}${ext}`;
  const filePath = path.join(UPLOADS_DIR, storedName);

  fs.writeFileSync(filePath, file.buffer);

  const rows: FileRecord[] = await prisma.$queryRawUnsafe(`
    INSERT INTO dm_files (file_id, original_name, stored_name, mime_type, size_bytes, category, created_by, created_by_type, description, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, fileId, file.originalname, storedName, file.mimetype, file.size, category, createdBy, createdByType, description, JSON.stringify(metadata));

  return rows[0];
}

export async function createFileFromContent(
  content: string,
  filename: string,
  mimeType: string,
  createdBy: string,
  createdByType: 'user' | 'agent',
  description: string = '',
  category: string = 'generated',
  metadata: Record<string, any> = {}
): Promise<FileRecord> {
  const fileId = crypto.randomUUID();
  const ext = path.extname(filename) || '';
  const storedName = `${fileId}${ext}`;
  const filePath = path.join(UPLOADS_DIR, storedName);
  const buffer = Buffer.from(content, 'utf-8');

  fs.writeFileSync(filePath, buffer);

  const rows: FileRecord[] = await prisma.$queryRawUnsafe(`
    INSERT INTO dm_files (file_id, original_name, stored_name, mime_type, size_bytes, category, created_by, created_by_type, description, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, fileId, filename, storedName, mimeType, buffer.length, category, createdBy, createdByType, description, JSON.stringify(metadata));

  return rows[0];
}

export async function getFileById(fileId: string): Promise<FileRecord | null> {
  const rows: FileRecord[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM dm_files WHERE file_id = $1`, fileId
  );
  return rows[0] || null;
}

export async function getFilesByCreator(
  createdBy: string,
  limit: number = 50
): Promise<FileRecord[]> {
  return prisma.$queryRawUnsafe(
    `SELECT * FROM dm_files WHERE created_by = $1 ORDER BY created_at DESC LIMIT $2`,
    createdBy, limit
  );
}

export async function getRecentFiles(limit: number = 50): Promise<FileRecord[]> {
  return prisma.$queryRawUnsafe(
    `SELECT * FROM dm_files ORDER BY created_at DESC LIMIT $1`, limit
  );
}

export function getFilePath(storedName: string): string {
  return path.join(UPLOADS_DIR, storedName);
}

export async function deleteFile(fileId: string): Promise<boolean> {
  const file = await getFileById(fileId);
  if (!file) return false;

  const filePath = path.join(UPLOADS_DIR, file.stored_name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await prisma.$executeRawUnsafe(`DELETE FROM dm_files WHERE file_id = $1`, fileId);
  return true;
}

const MIME_MAP: Record<string, string> = {
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

export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}
