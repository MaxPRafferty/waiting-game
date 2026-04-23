import { MockAuth } from './implementations/mock/index.js';
import { SupabaseAuth } from './implementations/supabase/index.js';
import type { IAuth } from './interface.js';

const mode = process.env.DEPENDENCY_MODE || 'MOCK';
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_KEY || '';

export const auth: IAuth = mode === 'LIVE' 
  ? new SupabaseAuth(url, key) 
  : new MockAuth();
