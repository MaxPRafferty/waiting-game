import { MockStorage } from './implementations/mock/index.js';
import { SupabaseStorage } from './implementations/supabase/index.js';
import type { IStorage } from './interface.js';

const mode = process.env.DEPENDENCY_MODE || 'MOCK';
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_KEY || '';

export const storage: IStorage = mode === 'LIVE' 
  ? new SupabaseStorage(url, key) 
  : new MockStorage();
