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

  async sendOtp(target: { email?: string; phone?: string }) {
    await auth.sendOtp(target);
  }

  async verifyOtp(target: { email?: string; phone?: string }, code: string, type: 'email' | 'sms' | 'magiclink') {
    const { token, user } = await auth.verifyOtp(target, code, type);
    
    let profile = await storage.get(this.USERS_COLLECTION, user.id);
    if (!profile) {
      // Create a default profile if they signed in via OTP for the first time
      profile = {
        id: user.id,
        username: target.email || target.phone || 'anonymous',
        created_at: new Date().toISOString()
      };
      await storage.save(this.USERS_COLLECTION, user.id, profile);
    }
    
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
