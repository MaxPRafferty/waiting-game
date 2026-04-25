import { Express } from 'express';
import * as restHandlers from './handlers/rest/index.js';

export const bindRoutes = (app: Express) => {
  app.post('/join', restHandlers.joinHandler);
  app.post('/check', restHandlers.checkHandler);
  app.get('/viewport', restHandlers.viewportHandler);
  app.get('/leaderboard', restHandlers.leaderboardHandler);
  app.get('/activity', restHandlers.activityHandler);
  app.get('/endurance', restHandlers.enduranceHandler);
  app.get('/og-image', restHandlers.ogImageHandler);
};
