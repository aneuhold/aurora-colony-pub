interface TimeOfDay {
  hour: number;
  minute: number;
}

export interface HoursRow {
  label: string;
  open: string;
  close: string;
}

/**
 * Source of truth for day-of-week labels. Keyed by the lower-case full
 * weekday name in `Date.getDay()` order (Sunday first). Hand-typed rather
 * than derived from `Intl` because `shortLabel` is CMS author input — the
 * exact spellings in `hours.json` rows have to keep matching here, even if
 * CLDR shifts under us.
 */
const DAYS_CONFIG = {
  sunday: { shortLabel: 'Sun', longLabel: 'Sunday' },
  monday: { shortLabel: 'Mon', longLabel: 'Monday' },
  tuesday: { shortLabel: 'Tue', longLabel: 'Tuesday' },
  wednesday: { shortLabel: 'Wed', longLabel: 'Wednesday' },
  thursday: { shortLabel: 'Thu', longLabel: 'Thursday' },
  friday: { shortLabel: 'Fri', longLabel: 'Friday' },
  saturday: { shortLabel: 'Sat', longLabel: 'Saturday' }
} as const;

class DateTimeService {
  /**
   * Day rows in JS `Date.getDay()` order (0=Sun..6=Sat). Object key
   * iteration order is preserved for non-integer string keys, so
   * `Object.values(DAYS_CONFIG)` is a stable index-aligned list.
   */
  private static readonly DAYS = Object.values(DAYS_CONFIG);

  /**
   * Two-week threshold past which the relative-time formatter switches
   * from "Nd ago" to an absolute month-day date. Keeps the FB feed cards
   * readable for older entries.
   */
  private static readonly RELATIVE_DAYS_CUTOFF = 14;

  private static readonly RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat('en', {
    numeric: 'always',
    style: 'narrow'
  });

  private static readonly ABSOLUTE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  });

  /** Short day labels indexed by JS `Date.getDay()` (0=Sun..6=Sat). */
  readonly shortDayLabels = DateTimeService.DAYS.map((d) => d.shortLabel);

  /**
   * Parses a 12-hour clock string ("11:00 AM", "12:00 AM", "9:30 PM") into
   * 24-hour `{hour, minute}`. Returns `null` for malformed input. "12:00 AM"
   * parses to `{hour: 0, minute: 0}` — the cross-midnight wraparound is the
   * caller's responsibility.
   *
   * @param input Time string in "H:MM AM/PM" or "HH:MM AM/PM" form
   */
  parseTimeOfDay(input: string): TimeOfDay | null {
    const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(input.trim());
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const meridiem = match[3].toUpperCase();
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return { hour, minute };
  }

  /**
   * Converts a 12-hour clock string ("11:00 AM", "12:00 AM", "9:30 PM") to
   * the 24-hour `HH:mm` form used by ISO 8601 and schema.org's
   * `openingHoursSpecification`. Returns `null` for unparseable input.
   *
   * @param input Time string in "H:MM AM/PM" or "HH:MM AM/PM" form
   */
  to24HourTime(input: string): string | null {
    const parsed = this.parseTimeOfDay(input);
    if (!parsed) return null;
    const hh = String(parsed.hour).padStart(2, '0');
    const mm = String(parsed.minute).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /**
   * Expands a weekly-hours label ("Mon–Thu", "Fri", "Sat") into the full
   * weekday names ("Monday", "Tuesday", …) it covers. Returns `[]` for
   * unrecognized labels. Accepts en-dash, em-dash, or hyphen, and
   * wrap-around ranges like "Sat–Mon".
   *
   * @param label Day-range label
   */
  longDayNameForLabel(label: string) {
    return this.expandDayLabel(label).map((idx) => DateTimeService.DAYS[idx].longLabel);
  }

  /**
   * Total minutes since midnight for a TimeOfDay.
   *
   * @param t Time of day
   */
  minutesOf(t: TimeOfDay): number {
    return t.hour * 60 + t.minute;
  }

  /**
   * Expands a weekly-hours label ("Mon–Thu", "Fri", "Sat") into the day
   * indexes (0=Sun..6=Sat) it covers. Accepts en-dash, em-dash, or hyphen.
   *
   * @param label Day-range label
   */
  private expandDayLabel(label: string): number[] {
    const normalized = label.replace(/[–—]/g, '-');
    const parts = normalized.split('-').map((s) => s.trim());
    const indexOf = (shortLabel: string): number =>
      DateTimeService.DAYS.findIndex((d) => d.shortLabel === shortLabel);
    if (parts.length === 1) {
      const idx = indexOf(parts[0]);
      return idx < 0 ? [] : [idx];
    }
    const start = indexOf(parts[0]);
    const end = indexOf(parts[1]);
    if (start < 0 || end < 0) return [];
    const result: number[] = [];
    let i = start;
    const stop = (end + 1) % 7;
    while (i !== stop) {
      result.push(i);
      i = (i + 1) % 7;
    }
    return result;
  }

  /**
   * Finds the weekly row covering the given day index (0=Sun..6=Sat).
   *
   * @param rows Weekly hours rows
   * @param dayIdx Day index from `Date.getDay()`
   */
  rowForDay(rows: HoursRow[], dayIdx: number): HoursRow | undefined {
    for (const row of rows) {
      if (this.labelCoversDay(row.label, dayIdx)) return row;
    }
    return undefined;
  }

  /**
   * Returns true when the given day-range label covers the given day index.
   * Accepts single-day labels ("Fri"), range labels with en-dash, em-dash, or
   * hyphen ("Mon–Fri", "Sat-Sun"), and wrap-around ranges ("Sat–Mon").
   *
   * @param label Day-range label
   * @param dayIdx Day index from `Date.getDay()` (0=Sun..6=Sat)
   */
  labelCoversDay(label: string, dayIdx: number): boolean {
    return this.expandDayLabel(label).includes(dayIdx);
  }

  /**
   * Converts an ISO timestamp into a short relative-time string ("Just now",
   * "12m ago", "3h ago", "2d ago"). Past the two-week cutoff it switches to
   * an absolute "MMM d" date so older entries still read clearly. The "Nm /
   * Nh / Nd ago" and "MMM d" strings come from `Intl` — only the unit
   * bucket selection and the "Just now" sentinel live here.
   *
   * @param iso Timestamp in any form `Date` accepts (Graph's `+0000`
   *   suffix and standard `Z` suffix both work)
   * @param now Optional reference time — defaults to `new Date()`. Lets
   *   tests pin the clock.
   */
  formatRelativeTime(iso: string, now: Date = new Date()): string {
    const then = new Date(iso);
    const diffSec = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
    if (diffSec < 60) return 'Just now';
    const rel = DateTimeService.RELATIVE_TIME_FORMATTER;
    if (diffSec < 60 * 60) {
      return rel.format(-Math.floor(diffSec / 60), 'minute');
    }
    if (diffSec < 60 * 60 * 24) {
      return rel.format(-Math.floor(diffSec / (60 * 60)), 'hour');
    }
    const days = Math.floor(diffSec / (60 * 60 * 24));
    if (days < DateTimeService.RELATIVE_DAYS_CUTOFF) {
      return rel.format(-days, 'day');
    }
    return DateTimeService.ABSOLUTE_DATE_FORMATTER.format(then);
  }
}

export default new DateTimeService();
