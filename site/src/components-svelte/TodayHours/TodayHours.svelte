<!--
  @component
  Renders today's open–close hours — and, when `happyHour` is given, today's
  happy-hour line — computed in the visitor's browser.

  The site is a static build, so a build-time "Today" freezes to whatever day
  the site was last deployed (and the build server's UTC timezone), which is
  how the wrong day's hours end up showing. This island recomputes the current
  weekday on hydration and re-checks every minute, so the line tracks the
  visitor's real day. Browser-local time is used, consistent with OpenNowChip.
-->
<script lang="ts">
  import dateTimeService, { type HoursRow } from '$util/DateTime.service';
  import todayHoursClock from './TodayHoursClock.svelte';

  interface HappyHour {
    label: string;
    start: string;
    end: string;
  }

  interface Props {
    weekly: HoursRow[];
    /** When provided, a happy-hour line is shown on the days its label covers. */
    happyHour?: HappyHour;
  }

  const { weekly, happyHour }: Props = $props();

  const todayIdx = $derived(todayHoursClock.now.getDay());
  const todayRow = $derived(dateTimeService.rowForDay(weekly, todayIdx) ?? weekly[0]);
  const showHappyHour = $derived(
    happyHour ? dateTimeService.labelCoversDay(happyHour.label, todayIdx) : false
  );
</script>

{todayRow.open} – {todayRow.close}
{#if happyHour && showHappyHour}
  <span class="mt-1 block text-base font-normal text-foreground/70">
    Happy hour {happyHour.start} – {happyHour.end}
  </span>
{/if}
