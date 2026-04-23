import type { AuthUser, IAuth } from '../../interface.js';
import { v4 as uuidv4 } from 'uuid';

export class MockAuth implements IAuth {
  private sessions = new Map<string, AuthUser>();
  private credentials = new Map<string, { token: string; user: AuthUser; password: string }>();
  private mockOtps = new Map<string, string>();

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

  async sendOtp(target: { email?: string; phone?: string }): Promise<void> {
    const key = target.email || target.phone;
    if (!key) throw new Error('Email or phone required');
    
    // In mock mode, we just store '123456' as the code
    this.mockOtps.set(key, '123456');
    console.log(`[MockAuth] OTP for ${key}: 123456`);
  }

  async verifyOtp(target: { email?: string; phone?: string }, token: string, _type: string): Promise<{ token: string; user: AuthUser }> {
    const key = target.email || target.phone;
    if (!key) throw new Error('Email or phone required');

    const mockCode = this.mockOtps.get(key);
    if (mockCode !== token) {
      throw new Error('Invalid OTP');
    }

    // Reuse existing user if email matches
    let user = Array.from(this.credentials.values()).find(c => c.user.email === target.email)?.user;
    if (!user) {
      user = {
        id: uuidv4(),
        email: target.email,
        is_anonymous: false
      };
    }

    const sessionToken = uuidv4();
    this.sessions.set(sessionToken, user);
    return { token: sessionToken, user };
  }
}
