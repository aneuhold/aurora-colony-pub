export interface HoursRow {
  label: string;
  open: string;
  close: string;
}

export interface OpenStatus {
  isOpen: boolean;
  /** Display string for the close time when isOpen, e.g. "10:00 PM". */
  closesAt?: string;
  /** Display string for the next opening when closed, e.g. "9:00 AM Sat". */
  opensAt?: string;
}

interface TimeOfDay {
  hour: number;
  minute: number;
}

const DAY_LABEL_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

const SHORT_DAY: readonly string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const minutesOf = (t: TimeOfDay): number => t.hour * 60 + t.minute;

/**
 * Parses a 12-hour clock string ("11:00 AM", "12:00 AM", "9:30 PM") into
 * 24-hour `{hour, minute}`. Returns `null` for malformed input. "12:00 AM"
 * parses to `{hour: 0, minute: 0}` — the cross-midnight wraparound is the
 * caller's responsibility (see `computeStatus`).
 *
 * @param input Time string in "H:MM AM/PM" or "HH:MM AM/PM" form
 */
const parseTimeOfDay = (input: string): TimeOfDay | null => {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(input.trim());
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return { hour, minute };
};

/**
 * Expands a weekly-hours label ("Mon–Thu", "Fri", "Sat") into the day
 * indexes (0=Sun..6=Sat) it covers. Accepts en-dash, em-dash, or hyphen.
 *
 * @param label Day-range label
 */
const expandLabel = (label: string): number[] => {
  const normalized = label.replace(/[–—]/g, '-');
  const parts = normalized.split('-').map((s) => s.trim());
  if (parts.length === 1) {
    const idx = DAY_LABEL_TO_INDEX[parts[0]];
    return idx === undefined ? [] : [idx];
  }
  const start = DAY_LABEL_TO_INDEX[parts[0]];
  const end = DAY_LABEL_TO_INDEX[parts[1]];
  if (start === undefined || end === undefined) return [];
  const result: number[] = [];
  let i = start;
  const stop = (end + 1) % 7;
  while (i !== stop) {
    result.push(i);
    i = (i + 1) % 7;
  }
  return result;
};

const rowForDay = (rows: HoursRow[], dayIdx: number): HoursRow | undefined => {
  for (const row of rows) {
    if (expandLabel(row.label).includes(dayIdx)) return row;
  }
  return undefined;
};

/**
 * Computes whether the pub is open at the given moment, with the next
 * relevant transition for display. Handles cross-midnight closes (Fri/Sat
 * "12:00 AM" means the next day's midnight) and rolls forward to scan up
 * to a week ahead when finding the next opening.
 *
 * @param now Current moment
 * @param rows Weekly hours rows
 */
const computeStatus = (now: Date, rows: HoursRow[]): OpenStatus => {
  const dayIdx = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const todayRow = rowForDay(rows, dayIdx);
  if (todayRow) {
    const open = parseTimeOfDay(todayRow.open);
    const close = parseTimeOfDay(todayRow.close);
    if (open && close) {
      const openMin = minutesOf(open);
      let closeMin = minutesOf(close);
      if (closeMin <= openMin) closeMin += 24 * 60;
      if (nowMin >= openMin && nowMin < closeMin) {
        return { isOpen: true, closesAt: todayRow.close };
      }
    }
  }

  const yesterdayIdx = (dayIdx + 6) % 7;
  const yesterdayRow = rowForDay(rows, yesterdayIdx);
  if (yesterdayRow) {
    const open = parseTimeOfDay(yesterdayRow.open);
    const close = parseTimeOfDay(yesterdayRow.close);
    if (open && close) {
      const openMin = minutesOf(open);
      const closeMin = minutesOf(close);
      const crossesMidnight = closeMin <= openMin;
      if (crossesMidnight && closeMin > 0 && nowMin < closeMin) {
        return { isOpen: true, closesAt: yesterdayRow.close };
      }
    }
  }

  if (todayRow) {
    const open = parseTimeOfDay(todayRow.open);
    if (open && nowMin < minutesOf(open)) {
      return { isOpen: false, opensAt: todayRow.open };
    }
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const idx = (dayIdx + offset) % 7;
    const row = rowForDay(rows, idx);
    if (!row) continue;
    return { isOpen: false, opensAt: `${row.open} ${SHORT_DAY[idx]}` };
  }

  return { isOpen: false };
};

class OpenNowChipService {
  parseTimeOfDay(input: string): TimeOfDay | null {
    return parseTimeOfDay(input);
  }

  expandLabel(label: string): number[] {
    return expandLabel(label);
  }

  computeStatus(now: Date, rows: HoursRow[]): OpenStatus {
    return computeStatus(now, rows);
  }
}

export default new OpenNowChipService();
