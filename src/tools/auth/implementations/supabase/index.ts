import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser, IAuth } from '../../interface.js';

export class SupabaseAuth implements IAuth {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  async validateToken(token: string): Promise<AuthUser | null> {
    const { data: { user }, error } = await this.client.auth.getUser(token);
    if (error || !user) return null;

    return {
      id: user.id,
      email: user.email,
      is_anonymous: user.aud === 'anonymous'
    };
  }

  async signInAnonymous(): Promise<{ token: string; user: AuthUser }> {
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error || !data.session || !data.user) {
      throw new Error(`Supabase anonymous sign-in failed: ${error?.message}`);
    }

    return {
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        is_anonymous: true
      }
    };
  }

  async signUp(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error || !data.session || !data.user) {
      throw new Error(`Supabase sign-up failed: ${error?.message}`);
    }

    return {
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        is_anonymous: false
      }
    };
  }

  async signIn(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw new Error(`Supabase sign-in failed: ${error?.message}`);
    }

    return {
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        is_anonymous: false
      }
    };
  }

  async sendOtp(target: { email?: string; phone?: string }): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      email: target.email || undefined,
      phone: target.phone || undefined,
    } as any);
    if (error) throw new Error(`Supabase send OTP failed: ${error.message}`);
  }

  async verifyOtp(target: { email?: string; phone?: string }, token: string, type: 'email' | 'sms' | 'magiclink'): Promise<{ token: string; user: AuthUser }> {
    const params: any = {
      token,
      type
    };
    if (target.email) params.email = target.email;
    if (target.phone) params.phone = target.phone;

    const { data, error } = await this.client.auth.verifyOtp(params);
    if (error || !data.session || !data.user) {
      throw new Error(`Supabase verify OTP failed: ${error?.message}`);
    }

    return {
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        is_anonymous: false
      }
    };
  }
}
