<!--
  @component
  Small "Open until X" / "Closed · opens Y" pill used in the home hero overlay.
  SSR renders a neutral fallback so the slot has stable dimensions; the live
  status replaces it on hydration. Recomputes every 60s.
-->
<script lang="ts">
  import openNowChipService, { type HoursRow, type OpenStatus } from './OpenNowChip.service';

  interface Props {
    weekly: HoursRow[];
  }

  const { weekly }: Props = $props();

  let hydrated = $state(false);
  let now = $state(new Date());

  $effect(() => {
    hydrated = true;
    const id = setInterval(() => {
      now = new Date();
    }, 60_000);
    return () => clearInterval(id);
  });

  const status = $derived<OpenStatus | null>(
    hydrated ? openNowChipService.computeStatus(now, weekly) : null
  );
</script>

<span
  class="inline-flex items-center gap-2 rounded-full bg-background/10 px-3 py-1 text-sm font-medium text-background ring-1 ring-background/20"
>
  {#if status}
    <span class={'h-2 w-2 rounded-full ' + (status.isOpen ? 'bg-accent' : 'bg-background/50')}
    ></span>
    {#if status.isOpen}
      Open until {status.closesAt}
    {:else if status.opensAt}
      Closed · opens {status.opensAt}
    {:else}
      Closed
    {/if}
  {:else}
    <span class="h-2 w-2 rounded-full bg-background/30"></span>
    See today's hours
  {/if}
</span>
