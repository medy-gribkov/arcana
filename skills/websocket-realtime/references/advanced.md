# WebSocket Advanced Patterns

Extended examples for SSE, Socket.io, Redis scaling, message validation, and a complete production server.

## Server-Sent Events (SSE) Alternative

**BAD**: No SSE implementation for one-way updates.

**GOOD**: SSE for server-to-client streaming.

```typescript
import express from 'express';

const app = express();

app.get('/events', (req, res) => {
  const token = req.query.token as string;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial connection event
    sendEvent({ type: 'connected', userId: payload.userId });

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      console.log('SSE client disconnected');
    });

    // Example: Subscribe to events
    subscribeToUserEvents(payload.userId, sendEvent);
  } catch (err) {
    res.status(401).send('Invalid token');
  }
});

app.listen(3000);
```

## Socket.io Rooms and Namespaces

**BAD**: Using vanilla Socket.io without room organization.

```typescript
import { Server } from 'socket.io';

const io = new Server(3000);

io.on('connection', (socket) => {
  socket.on('message', (data) => {
    io.emit('message', data); // Everyone gets everything
  });
});
```

**GOOD**: Namespaces for separation, rooms for grouping.

```typescript
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

const io = new Server(3000, {
  cors: { origin: '*' },
});

// Middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    socket.data.userId = payload.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// Namespace for chat
const chatNamespace = io.of('/chat');

chatNamespace.on('connection', (socket) => {
  console.log(`User ${socket.data.userId} connected to chat`);

  socket.on('join', (room: string) => {
    socket.join(room);
    chatNamespace.to(room).emit('user-joined', {
      userId: socket.data.userId,
      room,
    });
  });

  socket.on('leave', (room: string) => {
    socket.leave(room);
    chatNamespace.to(room).emit('user-left', {
      userId: socket.data.userId,
      room,
    });
  });

  socket.on('message', (data: { room: string; text: string }) => {
    chatNamespace.to(data.room).emit('message', {
      from: socket.data.userId,
      text: data.text,
      timestamp: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.data.userId} disconnected`);
  });
});
```

## Redis Pub/Sub for Horizontal Scaling

**BAD**: Single-server Socket.io without distributed state.

**GOOD**: Redis adapter for multi-server deployments.

```typescript
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const io = new Server(3000);

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Redis adapter connected');
});

io.on('connection', (socket) => {
  // All events are now distributed across server instances
  socket.on('message', (data: { room: string; text: string }) => {
    io.to(data.room).emit('message', {
      from: socket.data.userId,
      text: data.text,
    });
  });
});
```

**Manual Redis Pub/Sub** (for custom ws implementation):

```typescript
import { createClient } from 'redis';

const publisher = createClient({ url: 'redis://localhost:6379' });
const subscriber = createClient({ url: 'redis://localhost:6379' });

await Promise.all([publisher.connect(), subscriber.connect()]);

// Subscribe to room channels
await subscriber.subscribe('room:lobby', (message) => {
  const msg = JSON.parse(message);
  broadcastToRoom('lobby', msg);
});

// Publish to room
function publishToRoom(room: string, message: any) {
  publisher.publish(`room:${room}`, JSON.stringify(message));
}

function handleMessage(client: Client, msg: any) {
  if (msg.type === 'message') {
    // Publish to Redis, all servers will receive
    publishToRoom(msg.room, {
      type: 'message',
      from: client.userId,
      data: msg.data,
    });
  }
}
```

## Message Serialization and Validation

**BAD**: No message schema validation.

```typescript
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  handleMessage(msg); // What if msg is malformed?
});
```

**GOOD**: Zod schema validation for incoming messages.

```typescript
import { z } from 'zod';

const MessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    room: z.string().min(1).max(50),
  }),
  z.object({
    type: z.literal('leave'),
    room: z.string().min(1).max(50),
  }),
  z.object({
    type: z.literal('message'),
    room: z.string().min(1).max(50),
    text: z.string().min(1).max(1000),
  }),
]);

type Message = z.infer<typeof MessageSchema>;

ws.on('message', (data) => {
  try {
    const raw = JSON.parse(data.toString());
    const msg = MessageSchema.parse(raw);
    handleMessage(client, msg);
  } catch (err) {
    ws.send(JSON.stringify({
      error: 'Invalid message format',
      details: err instanceof z.ZodError ? err.errors : undefined,
    }));
  }
});
```

## Complete Production Example

```typescript
import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { createClient } from 'redis';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

interface Client {
  ws: WebSocket;
  userId: string;
  rooms: Set<string>;
  isAlive: boolean;
}

const server = http.createServer();
const wss = new WebSocketServer({ server });
const clients = new Map<WebSocket, Client>();

const publisher = createClient({ url: REDIS_URL });
const subscriber = createClient({ url: REDIS_URL });

await Promise.all([publisher.connect(), subscriber.connect()]);

const MessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), room: z.string() }),
  z.object({ type: z.literal('leave'), room: z.string() }),
  z.object({ type: z.literal('message'), room: z.string(), text: z.string() }),
]);

subscriber.pSubscribe('room:*', (message, channel) => {
  const room = channel.replace('room:', '');
  const msg = JSON.parse(message);

  clients.forEach((client) => {
    if (client.rooms.has(room)) {
      client.ws.send(JSON.stringify(msg));
    }
  });
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

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

    ws.on('pong', () => { client.isAlive = true; });

    ws.on('message', async (data) => {
      try {
        const msg = MessageSchema.parse(JSON.parse(data.toString()));

        switch (msg.type) {
          case 'join':
            client.rooms.add(msg.room);
            break;
          case 'leave':
            client.rooms.delete(msg.room);
            break;
          case 'message':
            await publisher.publish(`room:${msg.room}`, JSON.stringify({
              type: 'message',
              from: client.userId,
              text: msg.text,
              timestamp: Date.now(),
            }));
            break;
        }
      } catch (err) {
        ws.send(JSON.stringify({ error: 'Invalid message' }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.send(JSON.stringify({ type: 'connected', userId: payload.userId }));
  } catch (err) {
    ws.close(1008, 'Invalid token');
  }
});

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = clients.get(ws);
    if (!client) return;
    if (!client.isAlive) {
      clients.delete(ws);
      return ws.terminate();
    }
    client.isAlive = false;
    ws.ping();
  });
}, 30000);

process.on('SIGTERM', async () => {
  clearInterval(heartbeat);
  wss.clients.forEach((ws) => ws.close(1000, 'Server shutting down'));
  await Promise.all([publisher.quit(), subscriber.quit()]);
  server.close(() => process.exit(0));
});

server.listen(8080, () => console.log('WebSocket server running on :8080'));
```
