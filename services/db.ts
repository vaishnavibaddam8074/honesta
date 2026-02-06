import { User, FoundItem } from '../types';

/**
 * HONESTA PERMANENT CLOUD DATABASE
 * Using a public JSON storage that persists across devices (Phone/Laptop).
 */
const API_URL = `https://jsonblob.com/api/jsonBlob/1343135804561825792`; 

interface CloudData {
  users: User[];
  items: FoundItem[];
}

const INITIAL_DATA: CloudData = { users: [], items: [] };

export const db = {
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
        users: Array.isArray(data?.users) ? data.users : [],
        items: Array.isArray(data?.items) ? data.items : []
      };
    } catch (error) {
      console.warn("Cloud unreachable, using local cache:", error);
      const cache = localStorage.getItem('honesta_emergency_cache');
      try {
        return cache ? JSON.parse(cache) : INITIAL_DATA;
      } catch (e) {
        return INITIAL_DATA;
      }
    }
  },

  async sync(data: CloudData): Promise<void> {
    try {
      localStorage.setItem('honesta_emergency_cache', JSON.stringify(data));

      const response = await fetch(API_URL, {
        method: 'PUT',
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