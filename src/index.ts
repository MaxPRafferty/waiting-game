import 'dotenv/config';
import http from 'http';
import express from 'express';
import path from 'path';
import { WebSocketServer } from 'ws';
import { bindRoutes } from './routes.js';
import { initWebSocket } from './handlers/websocket/index.js';

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(process.cwd(), 'client');

const app = express();
app.use(express.json());

// Bind REST routes
bindRoutes(app);

// Serve static files
app.use(express.static(CLIENT_DIR));

const httpServer = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server: httpServer });
initWebSocket(wss);

httpServer.listen(PORT, () => {
  console.log(`The Waiting Game (${process.env.DEPENDENCY_MODE} mode) is running at http://localhost:${PORT}`);
});
