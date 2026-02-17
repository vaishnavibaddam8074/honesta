import { User, FoundItem } from '../types';

/**
 * HONESTA CLOUD ENGINE v2.0
 * High-reliability persistence layer with auto-initialization.
 */
const BLOB_ID = '1343135804561825792'; // Unique HONESTA instance ID
const API_URL = `https://jsonblob.com/api/jsonBlob/${BLOB_ID}`; 

interface CloudData {
  users: User[];
  items: FoundItem[];
}

const INITIAL_DATA: CloudData = { users: [], items: [] };
const MAX_ITEMS = 30; 

// Internal Memory Cache
let memoryCache: CloudData | null = null;
let isInitializing = false;

export const db = {
  /**
   * Safe fetch with retry and timeout
   */
  async safeFetch(url: string, options: RequestInit, retries = 2): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          ...options.headers,
        }
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 1000));
        return this.safeFetch(url, options, retries - 1);
      }
      throw err;
    }
  },

  /**
   * Initializes or fetches the master dataset
   */
  async fetchAll(): Promise<CloudData> {
    if (memoryCache) return memoryCache;

    try {
      const response = await this.safeFetch(API_URL, { method: 'GET' });
      
      if (response.status === 404) {
        // Blob doesn't exist yet, initialize it
        await this.sync(INITIAL_DATA);
        memoryCache = INITIAL_DATA;
        return INITIAL_DATA;
      }

      const data = await response.json();
      const sanitized: CloudData = {
        users: Array.isArray(data?.users) ? data.users : [],
        items: Array.isArray(data?.items) ? data.items : []
      };
      
      memoryCache = sanitized;
      localStorage.setItem('honesta_backup', JSON.stringify(sanitized));
      return sanitized;
    } catch (error) {
      console.warn("Cloud offline, loading local backup...");
      const backup = localStorage.getItem('honesta_backup');
      memoryCache = backup ? JSON.parse(backup) : INITIAL_DATA;
      return memoryCache!;
    }
  },

  /**
   * Performs the actual Cloud Sync
   * @param wait - If true, the promise won't resolve until the network call finishes.
   */
  async sync(data: CloudData, wait = false): Promise<void> {
    memoryCache = data;
    localStorage.setItem('honesta_backup', JSON.stringify(data));

    const performSync = async () => {
      try {
        await this.safeFetch(API_URL, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } catch (err) {
        console.error("Cloud Sync failed (Retrying later):", err);
      }
    };

    if (wait) {
      await performSync();
    } else {
      performSync(); // Fire and forget for UX speed
    }
  },

  async init(): Promise<void> {
    if (!isInitializing) {
      isInitializing = true;
      await this.fetchAll();
      isInitializing = false;
    }
  },

  async getUsers(): Promise<User[]> {
    const data = await this.fetchAll();
    return data.users;
  },

  async saveUser(user: User): Promise<void> {
    const data = await this.fetchAll();
    const cleanEmail = user.email.toLowerCase().trim();
    
    // Avoid duplicates
    const exists = data.users.some(u => u.email.toLowerCase().trim() === cleanEmail);
    if (!exists) {
      data.users.push(user);
      // We WAIT for sync during registration to ensure account safety
      await this.sync(data, true); 
    }
  },

  async getItems(): Promise<FoundItem[]> {
    const data = await this.fetchAll();
    return data.items;
  },

  async saveItem(item: FoundItem): Promise<void> {
    const data = await this.fetchAll();
    data.items = [item, ...data.items].slice(0, MAX_ITEMS);
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