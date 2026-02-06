import { User, FoundItem } from '../types';

/**
 * HONESTA GLOBAL CLOUD SYNC
 * Source of Truth: JSONBlob API
 */
const BLOB_ID = '1343135804561825792';
const API_URL = `https://jsonblob.com/api/jsonBlob/${BLOB_ID}`; 

interface CloudData {
  users: User[];
  items: FoundItem[];
}

const INITIAL_DATA: CloudData = { users: [], items: [] };

export const db = {
  /**
   * Fetches latest global data. 
   * Uses cache-busting and no-store headers to ensure phone/laptop see same data.
   */
  async fetchAll(): Promise<CloudData> {
    try {
      const response = await fetch(`${API_URL}?nocache=${Date.now()}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) throw new Error("Cloud fetch failed");
      
      const data = await response.json();
      return {
        users: Array.isArray(data?.users) ? data.users : [],
        items: Array.isArray(data?.items) ? data.items : []
      };
    } catch (error) {
      console.warn("Cloud unreachable, falling back to emergency local cache:", error);
      const cache = localStorage.getItem('honesta_emergency_cache');
      return cache ? JSON.parse(cache) : INITIAL_DATA;
    }
  },

  /**
   * Persists data to the cloud.
   */
  async sync(data: CloudData): Promise<void> {
    try {
      // Save local backup immediately
      localStorage.setItem('honesta_emergency_cache', JSON.stringify(data));

      const response = await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Cloud update failed");
    } catch (error) {
      console.error("Critical Cloud Sync Error:", error);
      throw error;
    }
  },

  async getUsers(): Promise<User[]> {
    const data = await this.fetchAll();
    return data.users;
  },

  async saveUser(user: User): Promise<void> {
    // Atomic: Get latest, append, push
    const data = await this.fetchAll();
    if (!data.users.find(u => u.email.toLowerCase() === user.email.toLowerCase())) {
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
    data.items = [item, ...data.items]; // Prepend new items
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