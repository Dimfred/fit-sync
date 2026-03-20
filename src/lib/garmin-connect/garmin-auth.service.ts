import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import GarminConnect from './garmin/GarminConnect';
import { TauriCryptoProvider } from './implementations/TauriCryptoProvider';
import { FileTokenStorage } from './implementations/FileTokenStorage';

const AUTH_TIMEOUT_MS = 3 * 60 * 1000;

export class GarminAuthService {
  private gc: GarminConnect;
  private tokenStorage: FileTokenStorage;

  constructor() {
    this.tokenStorage = new FileTokenStorage();
    this.gc = new GarminConnect(
      { username: '', password: '' },
      'garmin.com',
      this.tokenStorage,
      undefined,
      new TauriCryptoProvider(),
    );
  }

  async tryLoadExistingTokens(): Promise<boolean> {
    try {
      await this.gc.loadTokenUsingStorage();
      return true;
    } catch {
      return false;
    }
  }

  async authenticate(): Promise<void> {
    const { authUrl, ticketPromise } = await this.gc.initiateLogin();

    await invoke('open_garmin_auth', { authUrl });

    // Listen for ticket from Rust's on_navigation callback
    const ticketFromEvent = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, AUTH_TIMEOUT_MS);

      listen<string>('garmin-auth-ticket', (event) => {
        clearTimeout(timeout);
        const url = event.payload;
        const params = new URLSearchParams(url.split('?')[1]);
        const ticket = params.get('ticket');
        if (ticket) {
          resolve(ticket);
        }
      });
    });

    try {
      const ticket = await Promise.race([ticketFromEvent, ticketPromise]);
      this.gc.handleAuthCallback(`?ticket=${ticket}`);
      await this.gc.completeLogin(ticket);
    } finally {
      try {
        await invoke('close_garmin_auth');
      } catch {
        // Window might already be closed
      }
    }
  }

  async disconnect(): Promise<void> {
    await this.tokenStorage.clearTokens();
  }

  getClient(): GarminConnect {
    return this.gc;
  }
}
