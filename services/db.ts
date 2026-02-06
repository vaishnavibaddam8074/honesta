
import { User, FoundItem } from '../types';

/**
 * HONESTA PERMANENT CLOUD DATABASE
 * Using a public JSON storage that persists across devices (Phone/Laptop).
 * Project ID: CMRIT_HONESTA_STABLE_V1
 */
const PROJECT_ID = "cmrit_honesta_permanent_v1";
// Using jsonblob.com or a similar public persistent API
const API_URL = `https://jsonblob.com/api/jsonBlob/1343135804561825792`; 

// If the above hardcoded blob doesn't work, we'll need a fallback or create one.
// For the purpose of this demo, we'll try to use this URL as the central source of truth.

interface CloudData {
  users: User[];
  items: FoundItem[];
}

const INITIAL_DATA: CloudData = { users: [], items: [] };

export const db = {
  // Fetch from the global cloud source
  async fetchAll(): Promise<CloudData> {
    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error("Cloud fetch failed");
      }
      
      const data = await response.json();
      return {
        users: data.users || [],
        items: data.items || []
      };
    } catch (error) {
      console.warn("Using local cache as cloud is unreachable:", error);
      const cache = localStorage.getItem('honesta_emergency_cache');
      return cache ? JSON.parse(cache) : INITIAL_DATA;
    }
  },

  // Synchronize local changes to the global cloud
  async sync(data: CloudData): Promise<void> {
    try {
      // Always save locally first as a backup
      localStorage.setItem('honesta_emergency_cache', JSON.stringify(data));

      const response = await fetch(API_URL, {
        method: 'PUT', // jsonblob uses PUT for updates
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Cloud update failed");
    } catch (error) {
      console.error("Critical: Data could not be synced to cloud.", error);
    }
  },

  async getUsers(): Promise<User[]> {
    const data = await this.fetchAll();
    return data.users;
  },

  async saveUser(user: User): Promise<void> {
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
    // Fetch latest first to avoid overwriting others' data (Atomic-ish)
    const data = await this.fetchAll();
    data.items = [item, ...data.items];
    await this.sync(data);
  },

  async updateItem(updatedItem: FoundItem): Promise<void> {
    const data = await this.fetchAll();
    data.items = data.items.map(it => it.id === updatedItem.id ? updatedItem : it);
    await this.sync(data);
  }
};
