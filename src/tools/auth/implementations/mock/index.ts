import type { AuthUser, IAuth } from '../../interface.js';
import { v4 as uuidv4 } from 'uuid';

export class MockAuth implements IAuth {
  private sessions = new Map<string, AuthUser>();

  async validateToken(token: string): Promise<AuthUser | null> {
    return this.sessions.get(token) || null;
  }

  async signInAnonymous(): Promise<{ token: string; user: AuthUser }> {
    const token = uuidv4();
    const user: AuthUser = {
      id: uuidv4(),
      is_anonymous: true
    };
    this.sessions.set(token, user);
    return { token, user };
  }
}
