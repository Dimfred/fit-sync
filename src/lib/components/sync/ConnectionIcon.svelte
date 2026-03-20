<script lang="ts">
import GarminIcon from '$lib/components/icons/GarminIcon.svelte';
import type { Connection } from './sync.types';

interface Props {
  connection: Connection;
  ontoggle: () => void;
}

let { connection, ontoggle }: Props = $props();
</script>

<button
  onclick={ontoggle}
  title={connection.connected ? `${connection.name} (connected)` : `Connect to ${connection.name}`}
  class="rounded-md p-2 transition-colors hover:bg-bg-elevated"
>
  {#if connection.id === 'garmin'}
    <GarminIcon class={connection.connected ? '' : 'grayscale opacity-40'} />
  {/if}
</button>
