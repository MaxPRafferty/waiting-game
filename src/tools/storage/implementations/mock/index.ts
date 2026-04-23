import type { IStorage } from '../../interface.js';

export class MockStorage implements IStorage {
  private data = new Map<string, Map<string, any>>();

  async save(collection: string, key: string, data: any): Promise<void> {
    if (!this.data.has(collection)) {
      this.data.set(collection, new Map());
    }
    this.data.get(collection)!.set(key, data);
  }

  async get(collection: string, key: string): Promise<any | null> {
    return this.data.get(collection)?.get(key) || null;
  }

  async delete(collection: string, key: string): Promise<void> {
    this.data.get(collection)?.delete(key);
  }

  async list(collection: string): Promise<any[]> {
    const col = this.data.get(collection);
    return col ? Array.from(col.values()) : [];
  }
}
