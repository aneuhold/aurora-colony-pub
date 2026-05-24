<!--
  @component
  Mobile-only hamburger button + slide-down nav panel. Rendered inside the
  sticky <nav> so the panel positions full-width below the bar. Closes on link
  click, Escape, or toggle. Hidden at md+ via the wrapping class on the host.
-->
<script lang="ts">
  import HamburgerButton from './HamburgerButton.svelte';

  interface NavLink {
    href: string;
    label: string;
  }

  interface Props {
    links: NavLink[];
    currentPath: string;
  }

  const { links, currentPath }: Props = $props();

  const panelId = 'mobile-nav-panel';

  let open = $state(false);

  const isCurrent = (href: string): boolean => {
    const normalized = href.replace(/\/$/, '') || '/';
    return normalized === currentPath;
  };

  const close = (): void => {
    open = false;
  };

  const toggle = (): void => {
    open = !open;
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && open) {
      close();
    }
  };
</script>

<svelte:window onkeydown={handleKeydown} />

<HamburgerButton {open} controls={panelId} onclick={toggle} />

{#if open}
  <div
    id={panelId}
    class="absolute inset-x-0 top-full border-b border-foreground/10 bg-background/95 backdrop-blur animate-fade-in"
  >
    <ul class="m-0 flex list-none flex-col gap-1 px-6 py-4">
      {#each links as link (link.href)}
        <li>
          <a
            href={link.href}
            aria-current={isCurrent(link.href) ? 'page' : undefined}
            onclick={close}
            class="block rounded-md px-3 py-3 font-display text-lg text-foreground/80 transition-colors duration-snap ease-soft hover:bg-foreground/5 hover:text-foreground aria-[current=page]:bg-foreground/5 aria-[current=page]:text-foreground"
          >
            {link.label}
          </a>
        </li>
      {/each}
    </ul>
  </div>
{/if}
