import { Store } from '@tauri-apps/plugin-store';
import type { AppData, ConnectionConfig, SyncConfigData, SyncedFile } from './app-store.types';

const STORE_KEY = 'data';

const DEFAULT_DATA: AppData = {
  connections: [{ id: 'garmin', name: 'Garmin', connected: false }],
  syncs: [],
  syncedFiles: [],
};

class AppStore {
  private store: Store | null = null;
  data = $state<AppData>(structuredClone(DEFAULT_DATA));

  private async getStore(): Promise<Store> {
    if (!this.store) {
      this.store = await Store.load('app-data.json');
    }
    return this.store;
  }

  async load(): Promise<void> {
    const store = await this.getStore();
    const saved = await store.get<AppData>(STORE_KEY);
    if (!saved) return;

    // Merge with defaults to pick up new connections added in future versions
    this.data = {
      connections: DEFAULT_DATA.connections.map((def) => {
        const saved_conn = saved.connections?.find((c) => c.id === def.id);
        return saved_conn ?? def;
      }),
      syncs: saved.syncs ?? [],
      syncedFiles: saved.syncedFiles ?? [],
    };
  }

  async save(): Promise<void> {
    const store = await this.getStore();
    await store.set(STORE_KEY, this.data);
    await store.save();
  }

  getConnection(id: string): ConnectionConfig | undefined {
    return this.data.connections.find((c) => c.id === id);
  }

  async setConnectionStatus(id: string, connected: boolean): Promise<void> {
    const conn = this.getConnection(id);
    if (!conn) return;
    conn.connected = connected;
    await this.save();
  }

  async addSync(sync: SyncConfigData): Promise<void> {
    this.data.syncs.push(sync);
    await this.save();
  }

  async removeSync(id: string): Promise<void> {
    this.data.syncs = this.data.syncs.filter((s) => s.id !== id);
    await this.save();
  }

  async updateSync(updated: SyncConfigData): Promise<void> {
    const idx = this.data.syncs.findIndex((s) => s.id === updated.id);
    if (idx === -1) return;
    this.data.syncs[idx] = updated;
    await this.save();
  }

  async addSyncedFile(file: SyncedFile): Promise<void> {
    this.data.syncedFiles.push(file);
    await this.save();
  }

  isFileSynced(path: string, connectionId: string): boolean {
    return this.data.syncedFiles.some((f) => f.path === path && f.connectionId === connectionId);
  }
}

export const appStore = new AppStore();
