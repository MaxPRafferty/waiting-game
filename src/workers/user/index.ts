import { auth } from '../../tools/auth/index.js';
import { storage } from '../../tools/storage/index.js';

export class UserWorker {
  private USERS_COLLECTION = 'users';

  async signUp(username: string, email: string, pass: string) {
    const { token, user } = await auth.signUp(email, pass);
    
    // Save profile to storage
    await storage.save(this.USERS_COLLECTION, user.id, {
      id: user.id,
      username,
      created_at: new Date().toISOString()
    });

    return { token, user: { id: user.id, username, created_at: new Date().toISOString() } };
  }

  async signIn(email: string, pass: string) {
    const { token, user } = await auth.signIn(email, pass);
    const profile = await storage.get(this.USERS_COLLECTION, user.id);
    
    return { token, user: profile };
  }

  async getProfile(userId: string) {
    return await storage.get(this.USERS_COLLECTION, userId);
  }

  async validateSession(token: string) {
    return await auth.validateToken(token);
  }
}

export const userWorker = new UserWorker();
