import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { AuthPayload } from '../middleware/auth';
import { verifyAccessToken, isTokenBlacklisted, checkSessionActivity } from '../services/tokenService';

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const clients = new Map<string, AuthenticatedSocket>();

export function setupWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Heartbeat to detect dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const socket = ws as AuthenticatedSocket;
      if (!socket.isAlive) {
        socket.terminate();
        if (socket.userId) clients.delete(socket.userId);
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  wss.on('connection', (ws: AuthenticatedSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    let token = url.searchParams.get('token');

    if (!token) {
      const cookieHeader = req.headers.cookie || '';
      const match = cookieHeader.match(/cleo_auth=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      const payload = verifyAccessToken(token);

      (async () => {
        try {
          if (payload.jti && await isTokenBlacklisted(payload.jti)) {
            ws.close(4001, 'Token revoked');
            return;
          }
          const sessionActive = await checkSessionActivity(payload.userId);
          if (!sessionActive) {
            ws.close(4001, 'Session expired');
            return;
          }
          ws.userId = payload.userId;
          ws.isAlive = true;
          clients.set(payload.userId, ws);
          console.log(`🔌 WS connected: ${payload.userId}`);
        } catch {
          ws.close(4001, 'Authentication failed');
        }
      })();
    } catch {
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
      } catch {
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

function handleMessage(ws: AuthenticatedSocket, message: any) {
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
export function sendToUser(userId: string, type: string, payload: any) {
  const client = clients.get(userId);
  if (client?.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ type, payload }));
    return true;
  }
  return false;
}

// Broadcast to multiple users
export function broadcastToUsers(userIds: string[], type: string, payload: any) {
  const message = JSON.stringify({ type, payload });
  userIds.forEach((id) => {
    const client = clients.get(id);
    if (client?.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function closeAllWebSocketConnections(): Promise<void> {
  return new Promise((resolve) => {
    clients.forEach((ws, userId) => {
      try {
        ws.close(1001, 'Server shutting down');
      } catch {
        ws.terminate();
      }
    });
    clients.clear();
    resolve();
  });
}
