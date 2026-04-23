export interface IStorage {
  /**
   * Saves data to a persistent collection.
   */
  save(collection: string, key: string, data: any): Promise<void>;

  /**
   * Retrieves data from a collection.
   */
  get(collection: string, key: string): Promise<any | null>;

  /**
   * Deletes data from a collection.
   */
  delete(collection: string, key: string): Promise<void>;

  /**
   * Lists all items in a collection.
   */
  list(collection: string): Promise<any[]>;
}
