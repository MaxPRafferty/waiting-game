import './env.js';
import http from 'http';
import fs from 'fs';
import express from 'express';
import path from 'path';
import { WebSocketServer } from 'ws';
import { bindRoutes } from './routes.js';
import { initWebSocket } from './handlers/websocket/index.js';

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(process.cwd(), 'client', 'dist');
const CLIENT_DIR = path.join(process.cwd(), 'client');
const STATIC_DIR = fs.existsSync(DIST_DIR) ? DIST_DIR : CLIENT_DIR;

const app = express();
app.use(express.json());

// Bind REST routes
bindRoutes(app);

// Serve static files (built assets in production, raw client in dev)
app.use(express.static(STATIC_DIR));

const httpServer = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
initWebSocket(wss);

httpServer.listen(PORT, () => {
  console.log(`The Waiting Game (${process.env.DEPENDENCY_MODE} mode) is running at http://localhost:${PORT}`);
});
