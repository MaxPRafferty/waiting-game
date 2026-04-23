import type { AuthUser, IAuth } from '../../interface.js';
import { v4 as uuidv4 } from 'uuid';

export class MockAuth implements IAuth {
  private sessions = new Map<string, AuthUser>();
  private credentials = new Map<string, { token: string; user: AuthUser; password: string }>();

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

  async signUp(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    if (this.credentials.has(email)) {
      throw new Error('User already exists');
    }
    const token = uuidv4();
    const user: AuthUser = {
      id: uuidv4(),
      email,
      is_anonymous: false
    };
    this.credentials.set(email, { token, user, password });
    this.sessions.set(token, user);
    return { token, user };
  }

  async signIn(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const creds = this.credentials.get(email);
    if (!creds || creds.password !== password) {
      throw new Error('Invalid credentials');
    }
    this.sessions.set(creds.token, creds.user);
    return { token: creds.token, user: creds.user };
  }
}
