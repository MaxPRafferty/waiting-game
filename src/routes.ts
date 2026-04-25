import { Express } from 'express';
import * as restHandlers from './handlers/rest/index.js';

export const bindRoutes = (app: Express) => {
  app.post('/signup', restHandlers.signUpHandler);
  app.post('/signin', restHandlers.signInHandler);
  app.post('/auth/otp/send', restHandlers.sendOtpHandler);
  app.post('/auth/otp/verify', restHandlers.verifyOtpHandler);
  app.post('/checkbox/name', restHandlers.nameCheckboxHandler);
  app.get('/user/badges', restHandlers.getBadgesHandler);
  app.post('/follow', restHandlers.followHandler);
  app.get('/follow', restHandlers.listFollowsHandler);
  
  app.post('/join', restHandlers.joinHandler);
  app.post('/check', restHandlers.checkHandler);
  app.get('/viewport', restHandlers.viewportHandler);
  app.get('/leaderboard', restHandlers.leaderboardHandler);
  app.get('/activity', restHandlers.activityHandler);
  app.get('/endurance', restHandlers.enduranceHandler);
  app.get('/og-image', restHandlers.ogImageHandler);
};
