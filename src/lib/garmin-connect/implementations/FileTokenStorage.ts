import { Store } from '@tauri-apps/plugin-store';
import type { ITokenStorage } from '../common/ITokenStorage';
import type { IGarminTokens, IOauth1Token, IOauth2Token } from '../garmin/types';

const STORE_KEY_OAUTH1 = 'garmin_oauth1_token';
const STORE_KEY_OAUTH2 = 'garmin_oauth2_token';

export class FileTokenStorage implements ITokenStorage {
  private store: Store | null = null;

  private async getStore(): Promise<Store> {
    if (!this.store) {
      this.store = await Store.load('garmin-tokens.json');
    }
    return this.store;
  }

  async getTokens(): Promise<IGarminTokens | null> {
    try {
      const store = await this.getStore();
      const oauth1 = await store.get<IOauth1Token>(STORE_KEY_OAUTH1);
      const oauth2 = await store.get<IOauth2Token>(STORE_KEY_OAUTH2);

      if (!oauth1 || !oauth2) return null;

      return { oauth1, oauth2 };
    } catch (error) {
      console.error('FileTokenStorage: Failed to get tokens:', error);
      return null;
    }
  }

  async setTokens(oauth1: IOauth1Token, oauth2: IOauth2Token): Promise<void> {
    const store = await this.getStore();
    await store.set(STORE_KEY_OAUTH1, oauth1);
    await store.set(STORE_KEY_OAUTH2, oauth2);
    await store.save();
  }

  async clearTokens(): Promise<void> {
    const store = await this.getStore();
    await store.delete(STORE_KEY_OAUTH1);
    await store.delete(STORE_KEY_OAUTH2);
    await store.save();
  }
}
