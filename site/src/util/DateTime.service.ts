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
  private static readonly DAY_LABEL_TO_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  private static readonly SHORT_DAY_LABELS: readonly string[] = [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat'
  ];

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
      if (this.expandDayLabel(row.label).includes(dayIdx)) return row;
    }
    return undefined;
  }

  /**
   * Short day label ('Sun'..'Sat') for the given date.
   *
   * @param date Date to read the weekday from
   */
  shortDayLabel(date: Date): string {
    return DateTimeService.SHORT_DAY_LABELS[date.getDay()];
  }
}

export default new DateTimeService();
