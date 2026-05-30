<!--
  @component
  FacebookFeed island. Fetches the read Worker once on mount and renders the
  posts as editorial cards. Loading / empty / error / ready are handled in
  this file; all data behavior lives in `FacebookFeed.service.ts`.
-->
<script lang="ts">
  import type { WorkerFbFeedPost } from '@aurora/shared';
  import { MediaQuery } from 'svelte/reactivity';
  import dateTimeService from '$util/DateTime.service';
  import facebookFeedService from './FacebookFeed.service';
  import { facebookFeedConstants } from './facebookFeedConstants';

  type Status = 'loading' | 'ready' | 'error' | 'empty';

  let status = $state<Status>('loading');
  let posts = $state<WorkerFbFeedPost[]>([]);
  let errorMessage = $state('');

  $effect(() => {
    const load = async (): Promise<void> => {
      const result = await facebookFeedService.fetchFeed();
      if (!result.ok) {
        status = 'error';
        errorMessage = result.message;
        return;
      }
      if (result.data.posts.length === 0) {
        status = 'empty';
        return;
      }
      posts = result.data.posts;
      status = 'ready';
    };
    void load();
  });

  // Track the same breakpoints Tailwind uses (md = 48rem, lg = 64rem) so the JS
  // column logic matches what the CSS grid renders. `MediaQuery` from
  // svelte/reactivity keeps `.current` reactive and SSR-safe (the default
  // fallback renders mobile-first).
  const mdQuery = new MediaQuery('min-width: 48rem');
  const lgQuery = new MediaQuery('min-width: 64rem');

  const columnCount = $derived(lgQuery.current ? 3 : mdQuery.current ? 2 : 1);

  // Round-robin the posts across the active columns so they read left-to-right,
  // newest first (post i lands in column i % columnCount), then flow down the
  // page. Columns balance by count rather than height, which keeps a true
  // masonry feel without the column-major ordering CSS `columns` forces.
  const columns = $derived.by(() => {
    const cols: WorkerFbFeedPost[][] = Array.from({ length: columnCount }, () => []);
    posts.forEach((post, i) => {
      cols[i % columnCount].push(post);
    });
    return cols;
  });

  const skeletonRange = Array.from(
    { length: facebookFeedConstants.loadingSkeletonCount },
    (_, i) => i
  );

  // Staggered placeholder heights so the loading state hints at the masonry
  // layout instead of a uniform grid. Cycled by index.
  const skeletonHeights = ['h-56', 'h-72', 'h-48'];
</script>

<section aria-label="Latest from our Facebook page" data-testid="facebook-feed">
  {#if status === 'loading'}
    <ul
      class="list-none columns-1 gap-6 p-0 md:columns-2 lg:columns-3"
      data-testid="facebook-feed-loading"
    >
      {#each skeletonRange as i (i)}
        <li
          class="mb-6 break-inside-avoid overflow-hidden rounded-lg border border-foreground/10 bg-background"
        >
          <div
            class={`w-full animate-pulse bg-foreground/5 ${skeletonHeights[i % skeletonHeights.length]}`}
          ></div>
          <div class="space-y-3 p-5">
            <div class="h-3 w-24 animate-pulse rounded-sm bg-foreground/10"></div>
            <div class="h-3 w-full animate-pulse rounded-sm bg-foreground/10"></div>
            <div class="h-3 w-3/4 animate-pulse rounded-sm bg-foreground/10"></div>
          </div>
        </li>
      {/each}
    </ul>
  {:else if status === 'error' || status === 'empty'}
    <div data-testid="facebook-feed-fallback" class="text-foreground/80">
      <p>
        {status === 'error' ? errorMessage : facebookFeedConstants.emptyMessage}
      </p>
      <a
        href={facebookFeedConstants.facebookPageUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="mt-3 inline-block font-display text-sm uppercase tracking-[0.18em] text-primary underline-offset-4 transition-colors duration-snap ease-soft hover:underline"
      >
        {facebookFeedConstants.followLinkLabel}
      </a>
    </div>
  {:else}
    <!--
      Masonry-style layout. Posts are distributed across columns in JS (see
      `columns` above) so they read left-to-right, newest first, then flow down.
    -->
    <div class="flex gap-6" data-testid="facebook-feed-list">
      {#each columns as column, colIndex (colIndex)}
        <ul class="flex flex-1 list-none flex-col gap-6 p-0">
          {#each column as post (post.id)}
            <li class="reveal">
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={facebookFeedConstants.readOnFacebookAriaSuffix}
                class="group block overflow-hidden rounded-lg border border-foreground/10 bg-background transition-[transform,border-color] duration-snap ease-soft hover:-translate-y-1 hover:border-foreground/20"
              >
                <article class="flex flex-col">
                  {#if post.imageUrl}
                    <figure class=" bg-foreground/5">
                      <img src={post.imageUrl} alt="" loading="lazy" decoding="async" />
                    </figure>
                  {/if}
                  <div class="flex flex-1 flex-col gap-2 p-5">
                    <time
                      datetime={post.createdAt}
                      class="font-display text-sm uppercase tracking-[0.18em] text-foreground/60"
                    >
                      {dateTimeService.formatRelativeTime(post.createdAt)}
                    </time>
                    {#if post.message}
                      <p class="whitespace-pre-line leading-relaxed text-foreground/80">
                        {post.message}
                      </p>
                    {/if}
                    <span
                      class="mt-auto pt-2 font-display text-sm uppercase tracking-[0.18em] text-primary"
                    >
                      {facebookFeedConstants.readMoreLabel}
                    </span>
                  </div>
                </article>
              </a>
            </li>
          {/each}
        </ul>
      {/each}
    </div>
  {/if}
</section>
