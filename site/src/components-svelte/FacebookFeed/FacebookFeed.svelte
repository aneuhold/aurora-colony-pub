<!--
  @component
  FacebookFeed island. Fetches the read Worker once on mount and renders the
  posts as editorial cards. Loading / empty / error / ready are handled in
  this file; all data behavior lives in `FacebookFeed.service.ts`.
-->
<script lang="ts">
  import type { WorkerFbFeedPost } from '@aurora/shared';
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

  const skeletonRange = Array.from(
    { length: facebookFeedConstants.loadingSkeletonCount },
    (_, i) => i
  );
</script>

<section aria-label="Latest from our Facebook page" data-testid="facebook-feed">
  {#if status === 'loading'}
    <ul
      class="grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3"
      data-testid="facebook-feed-loading"
    >
      {#each skeletonRange as i (i)}
        <li class="overflow-hidden rounded-lg border border-foreground/10 bg-background">
          <div class="aspect-4/3 w-full animate-pulse bg-foreground/5"></div>
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
    <ul
      class="grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3"
      data-testid="facebook-feed-list"
    >
      {#each posts as post (post.id)}
        <li class="reveal">
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={facebookFeedConstants.readOnFacebookAriaSuffix}
            class="group block overflow-hidden rounded-lg border border-foreground/10 bg-background transition-[transform,border-color] duration-snap ease-soft hover:-translate-y-1 hover:border-foreground/20"
          >
            <article class="flex h-full flex-col">
              {#if post.imageUrl}
                <figure class="m-0 aspect-4/3 w-full overflow-hidden bg-foreground/5">
                  <img
                    src={post.imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    class="h-full w-full object-cover"
                  />
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
  {/if}
</section>
