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
}
