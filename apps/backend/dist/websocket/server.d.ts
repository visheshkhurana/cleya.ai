import { Server as HttpServer } from 'http';
export declare function setupWebSocket(server: HttpServer): void;
export declare function sendToUser(userId: string, type: string, payload: any): boolean;
export declare function closeAllWebSocketConnections(): void;
export declare function broadcastToUsers(userIds: string[], type: string, payload: any): void;
//# sourceMappingURL=server.d.ts.map