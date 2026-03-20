<script lang="ts">
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, X } from 'lucide-svelte';
import { Button } from '$lib/components/ui/button';
import * as Select from '$lib/components/ui/select';
import type { Connection, SyncConfig } from './sync.types';

interface Props {
  config: SyncConfig;
  connections: Connection[];
  onremove: () => void;
  onupdate: (config: SyncConfig) => void;
}

let { config, connections, onremove, onupdate }: Props = $props();

const availableConnections = $derived(connections.filter((c) => c.connected));

async function selectFolder() {
  const selected = await open({
    multiple: false,
    directory: true,
    title: 'Select folder to watch',
  });

  if (!selected) return;

  onupdate({ ...config, folderPath: selected });
}
</script>

<div class="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface px-4 py-3">
  <button
    onclick={selectFolder}
    class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border border-border-default bg-bg-input px-3 py-2 text-sm transition-colors hover:border-border-strong"
  >
    <FolderOpen class="size-4 shrink-0 text-text-muted" />
    {#if config.folderPath}
      <span class="truncate text-text-primary">{config.folderPath}</span>
    {:else}
      <span class="text-text-muted">Select folder...</span>
    {/if}
  </button>

  {#if availableConnections.length === 0}
    <div class="flex w-40 items-center justify-center rounded-md border border-border-default bg-bg-input px-3 py-2 text-sm text-text-muted">
      No connections
    </div>
  {:else}
    <Select.Root
      type="single"
      value={config.connectionId ?? undefined}
      onValueChange={(v) => onupdate({ ...config, connectionId: v as SyncConfig['connectionId'] })}
    >
      <Select.Trigger class="w-40 border-border-default bg-bg-input text-accent">
        {#if config.connectionId}
          <span>{connections.find((c) => c.id === config.connectionId)?.name}</span>
        {:else}
          <span class="text-text-muted">Select target...</span>
        {/if}
      </Select.Trigger>
      <Select.Content class="border-border-default bg-bg-elevated">
        {#each availableConnections as connection}
          <Select.Item value={connection.id} class="text-accent">
            {connection.name}
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  {/if}

  <Button variant="ghost" size="icon" onclick={onremove} class="shrink-0 text-text-muted hover:text-status-disconnected">
    <X class="size-4" />
  </Button>
</div>
