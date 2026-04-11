export declare function supabaseInsert<T = any>(table: string, data: Record<string, any>): Promise<T[]>;
export declare function supabaseSelect<T = any>(table: string, filters?: Record<string, string>, options?: {
    select?: string;
    order?: string;
    limit?: number;
}): Promise<T[]>;
export declare function supabaseUpdate(table: string, filters: Record<string, string>, data: Record<string, any>): Promise<void>;
export declare function supabaseUpsert<T = any>(table: string, data: Record<string, any>, onConflict: string): Promise<T[]>;
export declare function supabaseRpc(functionName: string, params?: Record<string, any>): Promise<any>;
//# sourceMappingURL=supabaseClient.d.ts.map