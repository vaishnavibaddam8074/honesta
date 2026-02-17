import { User, FoundItem } from '../types';

/**
 * HONESTA CLOUD ENGINE v2.3
 * Optimized for low-bandwidth campus environments.
 */
const BLOB_ID = '1343135804561825792'; 
const BASE_URL = `https://jsonblob.com/api/jsonBlob`;
const API_URL = `${BASE_URL}/${BLOB_ID}`; 

interface CloudData {
  users: User[];
  items: FoundItem[];
}

const INITIAL_DATA: CloudData = { users: [], items: [] };
const MAX_ITEMS = 25; // Slightly reduced to save bandwidth

let memoryCache: CloudData | null = null;
let isInitializing = false;

export const db = {
  async safeFetch(url: string, options: RequestInit, retries = 2): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); 

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
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

  async fetchAll(): Promise<CloudData> {
    if (memoryCache) return memoryCache;

    try {
      const response = await this.safeFetch(API_URL, { method: 'GET' });
      
      if (response.status === 404) {
        await this.sync(INITIAL_DATA, true);
        return INITIAL_DATA;
      }

      if (!response.ok) throw new Error("Server error");

      const data = await response.json();
      const sanitized: CloudData = {
        users: Array.isArray(data?.users) ? data.users : [],
        items: Array.isArray(data?.items) ? data.items : []
      };
      
      memoryCache = sanitized;
      localStorage.setItem('honesta_backup', JSON.stringify(sanitized));
      return sanitized;
    } catch (error) {
      const backup = localStorage.getItem('honesta_backup');
      memoryCache = backup ? JSON.parse(backup) : INITIAL_DATA;
      return memoryCache!;
    }
  },

  async sync(data: CloudData, wait = false): Promise<void> {
    memoryCache = data;
    localStorage.setItem('honesta_backup', JSON.stringify(data));

    const performSync = async () => {
      try {
        const putRes = await this.safeFetch(API_URL, {
          method: 'PUT',
          body: JSON.stringify(data),
        });

        if (putRes.status === 404) {
          await this.safeFetch(BASE_URL, {
            method: 'POST',
            body: JSON.stringify(data),
          });
        }
      } catch (err) {
        console.error("Cloud sync failed. Staying local.");
      }
    };

    if (wait) {
      await performSync();
    } else {
      performSync();
    }
  },

  async init(): Promise<void> {
    if (!isInitializing) {
      isInitializing = true;
      try { await this.fetchAll(); } catch (e) {}
      isInitializing = false;
    }
  },

  async getUsers(): Promise<User[]> {
    const data = await this.fetchAll();
    return data.users;
  },

  async saveUser(user: User): Promise<void> {
    const data = await this.fetchAll();
    if (!data.users.some(u => u.email.toLowerCase() === user.email.toLowerCase())) {
      data.users.push(user);
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
    await this.sync(data, true); 
  },

  async updateItem(updatedItem: FoundItem): Promise<void> {
    const data = await this.fetchAll();
    data.items = data.items.map(it => it.id === updatedItem.id ? updatedItem : it);
    await this.sync(data, true);
  },

  async deleteItem(itemId: string): Promise<void> {
    const data = await this.fetchAll();
    data.items = data.items.filter(it => it.id !== itemId);
    await this.sync(data, true);
  }
};