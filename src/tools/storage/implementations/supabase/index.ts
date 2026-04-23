import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { IStorage } from '../../interface.js';

export class SupabaseStorage implements IStorage {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  async save(collection: string, key: string, data: any): Promise<void> {
    const { error } = await this.client
      .from(collection)
      .upsert({ id: key, ...data });

    if (error) {
      console.warn(`[SupabaseStorage] Save error in ${collection}:`, error);
      throw error;
    }
  }

  async get(collection: string, key: string): Promise<any | null> {
    const { data, error } = await this.client
      .from(collection)
      .select('*')
      .eq('id', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.warn(`[SupabaseStorage] Get error in ${collection}:`, error);
      return null;
    }
    return data;
  }

  async delete(collection: string, key: string): Promise<void> {
    const { error } = await this.client
      .from(collection)
      .delete()
      .eq('id', key);

    if (error) {
      console.warn(`[SupabaseStorage] Delete error in ${collection}:`, error);
      throw error;
    }
  }

  async list(collection: string): Promise<any[]> {
    const { data, error } = await this.client
      .from(collection)
      .select('*');

    if (error) {
      console.warn(`[SupabaseStorage] List error in ${collection}:`, error);
      return [];
    }
    return data || [];
  }
}
