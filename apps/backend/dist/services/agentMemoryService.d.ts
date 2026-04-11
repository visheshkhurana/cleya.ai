interface MemoryContext {
    working: any | null;
    shortTerm: Array<{
        category: string;
        content: string;
        createdAt: Date;
    }>;
    longTerm: Array<{
        category: string;
        pattern: string;
        confidence: number;
    }>;
    episodic: Array<{
        eventType: string;
        title: string;
        description: string;
        occurredAt: Date;
    }>;
    semantic: Array<{
        content: string;
        category: string;
        similarity?: number;
    }>;
    shared: Array<{
        author: string;
        category: string;
        title: string;
        content: string;
        importance: string;
        createdAt: Date;
    }>;
}
export declare function getWorkingMemory(agentId: string): Promise<any | null>;
export declare function setWorkingMemory(agentId: string, data: any, sessionId?: string): Promise<void>;
export declare function clearWorkingMemory(agentId: string): Promise<void>;
export declare function addShortTermMemory(agentId: string, category: string, content: string, metadata?: any): Promise<string>;
export declare function getShortTermMemories(agentId: string, category?: string, limit?: number): Promise<any[]>;
export declare function deleteShortTermMemory(id: string, agentId?: string): Promise<void>;
export declare function cleanExpiredShortTermMemories(): Promise<number>;
export declare function addLongTermMemory(agentId: string, category: string, pattern: string, evidence?: string[], metadata?: any): Promise<string>;
export declare function getLongTermMemories(agentId: string, category?: string, limit?: number): Promise<any[]>;
export declare function deleteLongTermMemory(id: string, agentId?: string): Promise<void>;
export declare function addEpisodicMemory(agentId: string, eventType: string, title: string, description: string, impact?: string, tags?: string[], metadata?: any, occurredAt?: Date): Promise<string>;
export declare function getEpisodicMemories(agentId: string, eventType?: string, limit?: number): Promise<any[]>;
export declare function deleteEpisodicMemory(id: string, agentId?: string): Promise<void>;
export declare function addSemanticMemory(agentId: string, content: string, category: string, metadata?: any): Promise<string | null>;
export declare function searchSemanticMemory(agentId: string, query: string, limit?: number, minSimilarity?: number): Promise<Array<{
    id: string;
    content: string;
    category: string;
    similarity: number;
}>>;
export declare function getSemanticMemories(agentId: string, category?: string, limit?: number): Promise<any[]>;
export declare function deleteSemanticMemory(id: string, agentId?: string): Promise<void>;
interface SharedMemoryRow {
    id: number;
    author_agent_id: string;
    category: string;
    title: string;
    content: string;
    importance: string;
    tags: string[];
    metadata: any;
    expires_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare function addSharedMemory(authorAgentId: string, category: string, title: string, content: string, importance?: 'critical' | 'high' | 'normal' | 'low', tags?: string[], metadata?: any, expiresInHours?: number): Promise<number>;
export declare function getSharedMemories(category?: string, importance?: string, limit?: number): Promise<SharedMemoryRow[]>;
export declare function searchSharedMemories(searchTerm: string, limit?: number): Promise<SharedMemoryRow[]>;
export declare function getRecentSharedUpdates(limit?: number): Promise<SharedMemoryRow[]>;
export declare function assembleMemoryContext(agentId: string, taskContext?: string): Promise<MemoryContext>;
export declare function formatMemoryForPrompt(memory: MemoryContext): string;
export declare function storeRunMemories(agentId: string, runResult: {
    status: string;
    outputSummary: string;
    duration: number;
    error?: string;
}): Promise<void>;
export declare function getAllMemories(agentId: string): Promise<{
    working: any | null;
    shortTerm: any[];
    longTerm: any[];
    episodic: any[];
    semantic: any[];
}>;
export {};
//# sourceMappingURL=agentMemoryService.d.ts.map