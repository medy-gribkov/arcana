---
name: websocket-realtime
description: Build WebSocket servers, implement client reconnection with backoff, heartbeat keepalive, SSE, Socket.io rooms, Redis pub/sub scaling, and authentication.
user-invokable: true
argument-hint: "[server|client|sse|scaling]"
---

# WebSocket and Real-Time Communication

Build production-ready WebSocket servers with reconnection, heartbeat, authentication, and horizontal scaling.

## WebSocket Server (Node.js ws)

**BAD**: No connection lifecycle management.

```typescript
import WebSocket, { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    // Broadcast to everyone
    wss.clients.forEach((client) => {
      client.send(data);
    });
  });
});
```

**GOOD**: Connection tracking, error handling, graceful shutdown.

```typescript
import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';

interface Client {
  ws: WebSocket;
  userId: string;
  rooms: Set<string>;
  isAlive: boolean;
}

const server = http.createServer();
const wss = new WebSocketServer({ server });
const clients = new Map<WebSocket, Client>();

wss.on('connection', (ws, req) => {
  const client: Client = {
    ws,
    userId: '', // Set after auth
    rooms: new Set(),
    isAlive: true,
  };
  clients.set(ws, client);

  ws.on('pong', () => {
    client.isAlive = true;
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(client, msg);
    } catch (err) {
      ws.send(JSON.stringify({ error: 'Invalid message format' }));
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.send(JSON.stringify({ type: 'connected' }));
});

// Heartbeat interval
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = clients.get(ws);
    if (!client) return;

    if (!client.isAlive) {
      client.rooms.clear();
      clients.delete(ws);
      return ws.terminate();
    }

    client.isAlive = false;
    ws.ping();
  });
}, 30000);

// Graceful shutdown
process.on('SIGTERM', () => {
  clearInterval(heartbeat);
  wss.clients.forEach((ws) => {
    ws.close(1000, 'Server shutting down');
  });
  server.close(() => {
    process.exit(0);
  });
});

server.listen(8080);
```

## Client Reconnection with Exponential Backoff

**BAD**: No reconnection or infinite reconnect spam.

```typescript
const ws = new WebSocket('ws://localhost:8080');

ws.onclose = () => {
  // Lost connection, nothing happens
};
```

**GOOD**: Exponential backoff with jitter and max attempts.

```typescript
class ReconnectingWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseDelay = 1000;
  private maxDelay = 30000;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('Connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handleMessage(msg);
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    this.ws.onclose = () => {
      console.log('Disconnected');
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts),
      this.maxDelay
    );
    const jitter = delay * 0.3 * Math.random();
    const totalDelay = delay + jitter;

    this.reconnectAttempts++;
    console.log(`Reconnecting in ${Math.round(totalDelay)}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, totalDelay);
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not open, message queued');
    }
  }

  close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
  }

  private handleMessage(msg: any) {
    // Application logic
  }
}
```

## Authentication on WebSocket Upgrade

**BAD**: No authentication, anyone can connect.

```typescript
wss.on('connection', (ws) => {
  // Unauthenticated connection
});
```

**GOOD**: JWT verification during upgrade handshake.

```typescript
import jwt from 'jsonwebtoken';
import { parse } from 'url';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret';

wss.on('connection', (ws, req) => {
  const { query } = parse(req.url || '', true);
  const token = query.token as string;

  if (!token) {
    ws.close(1008, 'Authentication required');
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };

    const client: Client = {
      ws,
      userId: payload.userId,
      rooms: new Set(),
      isAlive: true,
    };
    clients.set(ws, client);

    ws.send(JSON.stringify({ type: 'authenticated', userId: payload.userId }));
  } catch (err) {
    ws.close(1008, 'Invalid token');
  }
});
```

## Room-Based Broadcasting

**BAD**: Broadcasting to all clients regardless of relevance.

```typescript
function broadcast(message: any) {
  wss.clients.forEach((client) => {
    client.send(JSON.stringify(message));
  });
}
```

**GOOD**: Room-based message routing.

```typescript
function joinRoom(client: Client, room: string) {
  client.rooms.add(room);
  client.ws.send(JSON.stringify({ type: 'joined', room }));
}

function leaveRoom(client: Client, room: string) {
  client.rooms.delete(room);
  client.ws.send(JSON.stringify({ type: 'left', room }));
}

function broadcastToRoom(room: string, message: any, excludeClient?: Client) {
  clients.forEach((client) => {
    if (client.rooms.has(room) && client !== excludeClient) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

function handleMessage(client: Client, msg: any) {
  switch (msg.type) {
    case 'join':
      joinRoom(client, msg.room);
      break;
    case 'leave':
      leaveRoom(client, msg.room);
      break;
    case 'message':
      broadcastToRoom(msg.room, {
        type: 'message',
        from: client.userId,
        data: msg.data,
      }, client);
      break;
  }
}
```

<!-- See references/advanced.md for extended examples -->
