<!--
  @component
  Demo Svelte 5 island that proves Astro+Svelte hydration is wired up.
-->
<script lang="ts">
  let count = $state(0);
  const label = $derived(count === 1 ? 'click' : 'clicks');
</script>

<button type="button" onclick={() => count++}>
  {count}
  {label}
</button>
