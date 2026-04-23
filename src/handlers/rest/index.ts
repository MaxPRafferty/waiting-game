import { Request, Response } from 'express';
import { queueWorker } from '../../workers/queue/index.js';

export const joinHandler = async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const result = await queueWorker.join(token);
    return res.json({
      seq: result.client.seq,
      position: result.mockPosition
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
