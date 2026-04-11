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
export declare function saveUploadedFile(file: Express.Multer.File, createdBy: string, createdByType: 'user' | 'agent', description?: string, category?: string, metadata?: Record<string, any>): Promise<FileRecord>;
export declare function createFileFromContent(content: string, filename: string, mimeType: string, createdBy: string, createdByType: 'user' | 'agent', description?: string, category?: string, metadata?: Record<string, any>): Promise<FileRecord>;
export declare function getFileById(fileId: string): Promise<FileRecord | null>;
export declare function getFilesByCreator(createdBy: string, limit?: number): Promise<FileRecord[]>;
export declare function getRecentFiles(limit?: number): Promise<FileRecord[]>;
export declare function getFilePath(storedName: string): string;
export declare function deleteFile(fileId: string): Promise<boolean>;
export declare function getMimeType(filename: string): string;
//# sourceMappingURL=fileService.d.ts.map