"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocket = setupWebSocket;
exports.sendToUser = sendToUser;
exports.closeAllWebSocketConnections = closeAllWebSocketConnections;
exports.broadcastToUsers = broadcastToUsers;
const ws_1 = require("ws");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const clients = new Map();
function setupWebSocket(server) {
    const wss = new ws_1.WebSocketServer({ server, path: '/ws' });
    // Heartbeat to detect dead connections
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            const socket = ws;
            if (!socket.isAlive) {
                socket.terminate();
                if (socket.userId)
                    clients.delete(socket.userId);
                return;
            }
            socket.isAlive = false;
            socket.ping();
        });
    }, 30000);
    wss.on('close', () => clearInterval(interval));
    wss.on('connection', (ws, req) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        let token = url.searchParams.get('token');
        if (!token) {
            const cookieHeader = req.headers.cookie || '';
            const match = cookieHeader.match(/cleo_auth=([^;]+)/);
            if (match)
                token = match[1];
        }
        if (!token) {
            ws.close(4001, 'Authentication required');
            return;
        }
        try {
            const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
            ws.userId = payload.userId;
            ws.isAlive = true;
            clients.set(payload.userId, ws);
            console.log(`🔌 WS connected: ${payload.userId}`);
        }
        catch {
            ws.close(4001, 'Invalid token');
            return;
        }
        ws.on('pong', () => {
            ws.isAlive = true;
        });
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                handleMessage(ws, message);
            }
            catch {
                ws.send(JSON.stringify({ error: 'Invalid message format' }));
            }
        });
        ws.on('close', () => {
            if (ws.userId) {
                clients.delete(ws.userId);
                console.log(`🔌 WS disconnected: ${ws.userId}`);
            }
        });
    });
    console.log('🔌 WebSocket server initialized');
}
function handleMessage(ws, message) {
    const { type, payload } = message;
    switch (type) {
        case 'chat:message':
            break;
        case 'dm:typing': {
            const recipientId = payload?.recipientId;
            if (recipientId && ws.userId) {
                sendToUser(recipientId, 'dm:typing', { userId: ws.userId });
            }
            break;
        }
        case 'dm:stop_typing': {
            const recipientId = payload?.recipientId;
            if (recipientId && ws.userId) {
                sendToUser(recipientId, 'dm:stop_typing', { userId: ws.userId });
            }
            break;
        }
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        default:
            ws.send(JSON.stringify({ error: `Unknown message type: ${type}` }));
    }
}
// Send message to a specific user
function sendToUser(userId, type, payload) {
    const client = clients.get(userId);
    if (client?.readyState === ws_1.WebSocket.OPEN) {
        client.send(JSON.stringify({ type, payload }));
        return true;
    }
    return false;
}
function closeAllWebSocketConnections() {
    clients.forEach((ws, userId) => {
        try {
            ws.close(1001, 'Server shutting down');
        }
        catch { }
    });
    clients.clear();
}
// Broadcast to multiple users
function broadcastToUsers(userIds, type, payload) {
    const message = JSON.stringify({ type, payload });
    userIds.forEach((id) => {
        const client = clients.get(id);
        if (client?.readyState === ws_1.WebSocket.OPEN) {
            client.send(message);
        }
    });
}
//# sourceMappingURL=server.js.map