<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Activity, Plus } from 'lucide-svelte';
import ConnectionIcon from '$lib/components/sync/ConnectionIcon.svelte';
import SyncCard from '$lib/components/sync/SyncCard.svelte';
import { Button } from '$lib/components/ui/button';
import { appStore } from '$lib/store/app-store.svelte';
import { GarminAuthService } from '$lib/garmin-connect/garmin-auth.service';
import { SyncService } from '$lib/sync/sync.service';
import type { SyncConfigData } from '$lib/store/app-store.types';

const garminAuth = new GarminAuthService();
const syncService = new SyncService(garminAuth);
let isAuthenticating = $state(false);
let loaded = $state(false);
let unlisten: (() => void) | null = null;

async function startWatcher(sync: SyncConfigData) {
  if (!sync.folderPath) return;
  try {
    await invoke('start_fit_watch', { syncId: sync.id, path: sync.folderPath });
  } catch (error) {
    console.error(`Failed to start watcher for ${sync.id}:`, error);
  }
}

async function stopWatcher(syncId: string) {
  try {
    await invoke('stop_fit_watch', { syncId });
  } catch (error) {
    console.error(`Failed to stop watcher for ${syncId}:`, error);
  }
}

async function startAllWatchers() {
  for (const sync of appStore.data.syncs) {
    await startWatcher(sync);
  }
}

onMount(async () => {
  await appStore.load();

  const hasTokens = await garminAuth.tryLoadExistingTokens();
  if (hasTokens) {
    await appStore.setConnectionStatus('garmin', true);
  }

  await startAllWatchers();

  unlisten = await listen<{ sync_id: string; path: string }>('fit-file-detected', (event) => {
    const { sync_id, path } = event.payload;
    console.log(`[FitSync] New .fit file detected: ${path} (sync: ${sync_id})`);
    syncService.handleFitFileDetected(sync_id, path);
  });

  loaded = true;
});

onDestroy(() => {
  unlisten?.();
  invoke('stop_all_fit_watches');
});

async function addSync() {
  const sync: SyncConfigData = {
    id: crypto.randomUUID(),
    folderPath: '',
    connectionId: null,
  };
  await appStore.addSync(sync);
}

async function removeSync(id: string) {
  await stopWatcher(id);
  await appStore.removeSync(id);
}

async function updateSync(updated: SyncConfigData) {
  const old = appStore.data.syncs.find((s) => s.id === updated.id);
  await appStore.updateSync(updated);

  if (old?.folderPath !== updated.folderPath) {
    await stopWatcher(updated.id);
    await startWatcher(updated);
  }
}

async function toggleConnection(id: string) {
  const conn = appStore.getConnection(id);
  if (!conn) return;

  if (conn.connected) {
    await garminAuth.disconnect();
    await appStore.setConnectionStatus(id, false);
    return;
  }

  if (isAuthenticating) return;
  isAuthenticating = true;

  try {
    await garminAuth.authenticate();
    await appStore.setConnectionStatus(id, true);
  } catch (error) {
    console.error('Garmin auth failed:', error);
  } finally {
    isAuthenticating = false;
  }
}
</script>

{#if loaded}
<div class="flex h-screen flex-col bg-bg-abyss">
  <header class="flex items-center justify-between border-b border-border-subtle px-6 py-4">
    <div class="flex items-center gap-3">
      <Activity class="size-6 text-accent" />
      <span class="font-heading text-2xl tracking-wider text-accent">FIT SYNC</span>
      <Button variant="ghost" size="icon" onclick={addSync} class="text-text-muted hover:text-accent">
        <Plus class="size-5" />
      </Button>
    </div>

    <div class="flex items-center gap-1">
      {#each appStore.data.connections as connection}
        <ConnectionIcon {connection} ontoggle={() => toggleConnection(connection.id)} />
      {/each}
    </div>
  </header>

  <main class="flex-1 overflow-y-auto p-6">
    {#if appStore.data.syncs.length === 0}
      <div class="flex h-full items-center justify-center">
        <div class="text-center">
          <p class="text-text-muted">No syncs configured.</p>
          <p class="mt-1 text-sm text-text-muted">Click + to add a sync.</p>
        </div>
      </div>
    {:else}
      <div class="flex flex-col gap-3">
        {#each appStore.data.syncs as config (config.id)}
          <SyncCard
            {config}
            connections={appStore.data.connections}
            onremove={() => removeSync(config.id)}
            onupdate={updateSync}
          />
        {/each}
      </div>
    {/if}
  </main>
</div>
{/if}
