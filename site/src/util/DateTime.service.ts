interface TimeOfDay {
  hour: number;
  minute: number;
}

export interface HoursRow {
  label: string;
  open: string;
  close: string;
}

class DateTimeService {
  /**
   * Short day labels indexed by JS `Date.getDay()` (0=Sun..6=Sat).
   *
   * Kept as a hand-typed literal (not derived from `Intl`) because these
   * exact strings are content-author input — `hours.yaml` rows use
   * `"Mon–Thu"`, `"Fri"`, etc., and `expandDayLabel` matches against this
   * map. Deriving from CLDR risks the labels shifting under us and silently
   * breaking the CMS content match.
   */
  private static readonly SHORT_DAY_LABELS: readonly string[] = [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat'
  ];

  /**
   * Reverse of {@link SHORT_DAY_LABELS}. Hand-typed for the same reason:
   * the keys are the literal strings the CMS author writes in hours rows.
   */
  private static readonly DAY_LABEL_TO_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

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
  readonly shortDayLabels = DateTimeService.SHORT_DAY_LABELS;

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
    if (parts.length === 1) {
      const idx = DateTimeService.DAY_LABEL_TO_INDEX[parts[0]];
      return idx === undefined ? [] : [idx];
    }
    const start = DateTimeService.DAY_LABEL_TO_INDEX[parts[0]];
    const end = DateTimeService.DAY_LABEL_TO_INDEX[parts[1]];
    if (start === undefined || end === undefined) return [];
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
   * Short day label ('Sun'..'Sat') for the given date.
   *
   * @param date Date to read the weekday from
   */
  shortDayLabel(date: Date): string {
    return DateTimeService.SHORT_DAY_LABELS[date.getDay()];
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
