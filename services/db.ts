import { User, FoundItem } from '../types';

/**
 * HONESTA OPTIMIZED CLOUD ENGINE
 * Uses a memory-resident singleton to provide "Instant-On" performance.
 */
const BLOB_ID = '1343135804561825792';
const API_URL = `https://jsonblob.com/api/jsonBlob/${BLOB_ID}`; 

interface CloudData {
  users: User[];
  items: FoundItem[];
}

const INITIAL_DATA: CloudData = { users: [], items: [] };
const MAX_ITEMS = 25; 

// Internal Singleton Cache
let memoryCache: CloudData | null = null;
let isFetching = false;

export const db = {
  /**
   * Warm up the database in memory. Call this as early as possible.
   */
  async init(): Promise<void> {
    if (memoryCache) return;
    try {
      await this.fetchAll();
    } catch (e) {
      console.warn("Warm up failed, will retry on next action.");
    }
  },

  async safeFetch(url: string, options: RequestInit, retries = 3): Promise<Response> {
    const timestamp = Date.now();
    const finalUrl = url.includes('?') ? `${url}&_t=${timestamp}` : `${url}?_t=${timestamp}`;
    
    try {
      const response = await fetch(finalUrl, {
        ...options,
        mode: 'cors',
        headers: {
          ...options.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
      if (!response.ok && retries > 0) throw new Error("Retry");
      return response;
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 800));
        return this.safeFetch(url, options, retries - 1);
      }
      throw err;
    }
  },

  /**
   * Fetches data with Memory-First strategy.
   * If data is in memory, returns it instantly and refreshes in background.
   */
  async fetchAll(): Promise<CloudData> {
    if (isFetching && memoryCache) return memoryCache;

    const performFetch = async () => {
      isFetching = true;
      try {
        const response = await this.safeFetch(API_URL, { method: 'GET' });
        const data = await response.json();
        const sanitized = {
          users: Array.isArray(data?.users) ? data.users : [],
          items: Array.isArray(data?.items) ? data.items : []
        };
        memoryCache = sanitized;
        localStorage.setItem('honesta_master_cache', JSON.stringify(sanitized));
        return sanitized;
      } catch (error) {
        console.error("Database Connectivity Issue:", error);
        if (!memoryCache) {
          const cache = localStorage.getItem('honesta_master_cache');
          memoryCache = cache ? JSON.parse(cache) : INITIAL_DATA;
        }
        return memoryCache!;
      } finally {
        isFetching = false;
      }
    };

    if (memoryCache) {
      performFetch(); // Background refresh
      return memoryCache;
    }
    return performFetch(); // First load
  },

  async sync(data: CloudData): Promise<void> {
    // Update local memory immediately for UI responsiveness
    memoryCache = data;
    localStorage.setItem('honesta_master_cache', JSON.stringify(data));

    try {
      if (data.items.length > MAX_ITEMS) {
        data.items = data.items.slice(0, MAX_ITEMS);
      }
      const response = await this.safeFetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Cloud Sync Failed");
    } catch (error) {
      console.error("Cloud Sync Error (Background):", error);
      // We don't throw here to keep the UI snappy, but we'll retry next fetch
    }
  },

  async getUsers(): Promise<User[]> {
    const data = await this.fetchAll();
    return data.users;
  },

  async saveUser(user: User): Promise<void> {
    const data = await this.fetchAll();
    const cleanEmail = user.email.toLowerCase().trim();
    if (!data.users.find(u => u.email.toLowerCase().trim() === cleanEmail)) {
      data.users.push(user);
      await this.sync(data);
    }
  },

  async getItems(): Promise<FoundItem[]> {
    const data = await this.fetchAll();
    return data.items;
  },

  async saveItem(item: FoundItem): Promise<void> {
    const data = await this.fetchAll();
    data.items = [item, ...data.items];
    await this.sync(data);
  },

  async updateItem(updatedItem: FoundItem): Promise<void> {
    const data = await this.fetchAll();
    data.items = data.items.map(it => it.id === updatedItem.id ? updatedItem : it);
    await this.sync(data);
  },

  async deleteItem(itemId: string): Promise<void> {
    const data = await this.fetchAll();
    data.items = data.items.filter(it => it.id !== itemId);
    await this.sync(data);
  }
};