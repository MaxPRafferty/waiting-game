import { Request, Response } from 'express';
import { queueWorker } from '../../workers/queue/index.js';
import { userWorker } from '../../workers/user/index.js';
import { badgeWorker, followWorker } from '../../workers/social/index.js';
import { broadcastToAll, broadcastToSubscribers, notifyPositionsBehind } from '../websocket/shared.js';

const authenticate = async (req: Request) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  return await userWorker.validateSession(token);
};

export const signUpHandler = async (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  try {
    const result = await userWorker.signUp(username, email, password);
    return res.json(result);
  } catch (error: any) {
    console.warn('Sign up error:', error);
    return res.status(400).json({ error: error.message });
  }
};

export const signInHandler = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const result = await userWorker.signIn(email, password);
    return res.json(result);
  } catch (error: any) {
    console.warn('Sign in error:', error);
    return res.status(401).json({ error: error.message });
  }
};

export const sendOtpHandler = async (req: Request, res: Response) => {
  const { email, phone } = req.body;
  try {
    await userWorker.sendOtp({ email, phone });
    return res.json({ success: true });
  } catch (error: any) {
    console.warn('Send OTP error:', error);
    return res.status(400).json({ error: error.message });
  }
};

export const verifyOtpHandler = async (req: Request, res: Response) => {
  const { email, phone, token, type } = req.body;
  try {
    const result = await userWorker.verifyOtp({ email, phone }, token, type);
    return res.json(result);
  } catch (error: any) {
    console.warn('Verify OTP error:', error);
    return res.status(401).json({ error: error.message });
  }
};

export const nameCheckboxHandler = async (req: Request, res: Response) => {
  const user = await authenticate(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { token, name } = req.body;
  try {
    await queueWorker.nameCheckbox(user.id, token, name);
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Name checkbox error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBadgesHandler = async (req: Request, res: Response) => {
  const user = await authenticate(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const badges = await badgeWorker.getUserBadges(user.id);
    return res.json({ badges });
  } catch (error: any) {
    console.error('Get badges error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const followHandler = async (req: Request, res: Response) => {
  const user = await authenticate(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { target_token, target_name } = req.body;
  try {
    await followWorker.follow(user.id, target_token, target_name);
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Follow error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const listFollowsHandler = async (req: Request, res: Response) => {
  const user = await authenticate(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const follows = await followWorker.getFollows(user.id);
    return res.json({ follows });
  } catch (error: any) {
    console.error('List follows error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

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
      position: result.position, 
      duration_ms: result.duration_ms 
    });

    await broadcastToSubscribers(result.seq, { 
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

export const ogImageHandler = async (req: Request, res: Response) => {
  const position = parseInt(req.query.position as string);
  if (isNaN(position)) {
    return res.status(400).json({ error: 'Invalid position parameter' });
  }

  try {
    const buffer = await queueWorker.generateOgImage(position);
    res.setHeader('Content-Type', 'image/png');
    return res.send(buffer);
  } catch (error) {
    console.error('OG Image error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
