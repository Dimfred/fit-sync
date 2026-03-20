import type { ConnectionId } from '$lib/components/sync/sync.types';

export interface ConnectionConfig {
  id: ConnectionId;
  name: string;
  connected: boolean;
}

export interface SyncConfigData {
  id: string;
  folderPath: string;
  connectionId: ConnectionId | null;
}

export interface SyncedFile {
  path: string;
  connectionId: ConnectionId;
  syncedAt: string;
}

export interface AppData {
  connections: ConnectionConfig[];
  syncs: SyncConfigData[];
  syncedFiles: SyncedFile[];
}
