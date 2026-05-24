<!--
  @component
  Toggle button that morphs between three lines and an X based on `open`.
  Presentational: owns no state, defers click handling to the parent.
-->
<script lang="ts">
  interface Props {
    open: boolean;
    controls: string;
    onclick: () => void;
  }

  const { open, controls, onclick }: Props = $props();
</script>

<button
  type="button"
  aria-label={open ? 'Close menu' : 'Open menu'}
  aria-expanded={open}
  aria-controls={controls}
  {onclick}
  class="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors duration-snap ease-soft hover:bg-foreground/5"
>
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    fill="none"
    aria-hidden="true"
  >
    {#if open}
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    {:else}
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    {/if}
  </svg>
</button>
