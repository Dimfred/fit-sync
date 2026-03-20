import {
  sendNotification,
  isPermissionGranted,
  requestPermission,
} from '@tauri-apps/plugin-notification';
import { appStore } from '$lib/store/app-store.svelte';
import type { GarminAuthService } from '$lib/garmin-connect/garmin-auth.service';

async function notify(title: string, body: string) {
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === 'granted';
  }
  if (!granted) return;
  sendNotification({ title, body });
}

export class SyncService {
  constructor(private garminAuth: GarminAuthService) {}

  async handleFitFileDetected(syncId: string, filePath: string): Promise<void> {
    const fileName = filePath.split('/').pop() || filePath;
    const sync = appStore.data.syncs.find((s) => s.id === syncId);

    if (!sync?.connectionId) {
      console.warn(`[SyncService] No connection configured for sync ${syncId}`);
      return;
    }

    if (appStore.isFileSynced(filePath, sync.connectionId)) {
      console.log(`[SyncService] File already synced: ${filePath}`);
      return;
    }

    const conn = appStore.getConnection(sync.connectionId);
    if (!conn?.connected) {
      await notify('FIT Sync', `${fileName} detected but ${sync.connectionId} is not connected.`);
      return;
    }

    console.log(`[SyncService] Uploading ${fileName} to ${sync.connectionId}...`);

    try {
      const gc = this.garminAuth.getClient();
      await gc.uploadActivity(filePath, 'fit');

      await appStore.addSyncedFile({
        path: filePath,
        connectionId: sync.connectionId,
        syncedAt: new Date().toISOString(),
      });

      await notify('FIT Sync', `${fileName} synced to ${conn.name}.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[SyncService] Upload failed for ${fileName}:`, msg);

      let reason = msg;
      try {
        const jsonMatch = msg.match(/:\s*(\{.*\})$/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          const failure = parsed?.detailedImportResult?.failures?.[0];
          reason = failure?.messages?.[0]?.content || reason;
        }
      } catch {
        // keep raw message
      }

      await notify('FIT Sync', `${fileName}: ${reason}`);
    }
  }
}
