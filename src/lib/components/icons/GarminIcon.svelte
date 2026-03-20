<script lang="ts">
interface Props {
  class?: string;
}

let { class: className = '' }: Props = $props();
</script>

<img src="/garmin-logo.svg" alt="Garmin" class="h-5 w-auto {className}" />
