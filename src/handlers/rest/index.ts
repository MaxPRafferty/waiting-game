import { Request, Response } from 'express';
import { queueWorker } from '../../workers/queue/index.js';
import { broadcastToAll, publishToSubscribers, notifyPositionsBehind } from '../websocket/shared.js';

export const joinHandler = async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const result = await queueWorker.join(token);
    return res.json({
      seq: result.client.seq,
      position: result.absolutePosition
    });
  } catch (error) {
    console.error('Join error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const checkHandler = async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const result = await queueWorker.check(token);
    if (!result.success) {
      return res.status(403).json({ error: 'Not eligible or already checked' });
    }

    await broadcastToAll({
      type: 'winner',
      seq: result.seq,
      duration_ms: result.duration_ms
    });

    await publishToSubscribers(result.seq, {
      type: 'range_update',
      seq: result.seq,
      position: result.position,
      state: 'checked'
    });

    await notifyPositionsBehind(result.seq);

    return res.json({
      position: result.position,
      duration_ms: result.duration_ms
    });
  } catch (error) {
    console.error('Check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const viewportHandler = async (req: Request, res: Response) => {
  const from = parseInt(req.query.from as string);
  const to = parseInt(req.query.to as string);

  if (isNaN(from) || isNaN(to)) {
    return res.status(400).json({ error: 'Invalid from or to parameters' });
  }

  try {
    const result = await queueWorker.getViewport(from, to);
    return res.json(result);
  } catch (error) {
    console.error('Viewport error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const leaderboardHandler = async (_req: Request, res: Response) => {
  try {
    const winners = await queueWorker.getLeaderboard();
    return res.json({ winners });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const activityHandler = async (_req: Request, res: Response) => {
  try {
    const winners = await queueWorker.getLeaderboard(20);
    return res.json({ activity: winners });
  } catch (error) {
    console.error('Activity error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const enduranceHandler = async (_req: Request, res: Response) => {
  try {
    const entries = await queueWorker.getEnduranceHall(10);
    return res.json({ entries });
  } catch (error) {
    console.error('Endurance error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const ogImageHandler = async (req: Request, res: Response) => {
  const seq = parseInt(req.query.seq as string);
  if (isNaN(seq)) {
    return res.status(400).json({ error: 'Invalid seq parameter' });
  }

  try {
    const buffer = await queueWorker.generateOgImage(seq);
    res.setHeader('Content-Type', 'image/png');
    return res.send(buffer);
  } catch (error) {
    console.error('OG Image error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
