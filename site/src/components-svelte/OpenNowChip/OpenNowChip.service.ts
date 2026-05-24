import dateTimeService, { type HoursRow } from '$util/DateTime.service';

export type { HoursRow };

export interface OpenStatus {
  isOpen: boolean;
  /** Display string for the close time when isOpen, e.g. "10:00 PM". */
  closesAt?: string;
  /** Display string for the next opening when closed, e.g. "9:00 AM Sat". */
  opensAt?: string;
}

class OpenNowChipService {
  /**
   * Computes whether the pub is open at the given moment, with the next
   * relevant transition for display. Handles cross-midnight closes (Fri/Sat
   * "12:00 AM" means the next day's midnight) and rolls forward to scan up
   * to a week ahead when finding the next opening.
   *
   * @param now Current moment
   * @param rows Weekly hours rows
   */
  computeStatus(now: Date, rows: HoursRow[]): OpenStatus {
    const dayIdx = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const todayRow = dateTimeService.rowForDay(rows, dayIdx);
    if (todayRow) {
      const open = dateTimeService.parseTimeOfDay(todayRow.open);
      const close = dateTimeService.parseTimeOfDay(todayRow.close);
      if (open && close) {
        const openMin = dateTimeService.minutesOf(open);
        let closeMin = dateTimeService.minutesOf(close);
        if (closeMin <= openMin) closeMin += 24 * 60;
        if (nowMin >= openMin && nowMin < closeMin) {
          return { isOpen: true, closesAt: todayRow.close };
        }
      }
    }

    const yesterdayIdx = (dayIdx + 6) % 7;
    const yesterdayRow = dateTimeService.rowForDay(rows, yesterdayIdx);
    if (yesterdayRow) {
      const open = dateTimeService.parseTimeOfDay(yesterdayRow.open);
      const close = dateTimeService.parseTimeOfDay(yesterdayRow.close);
      if (open && close) {
        const openMin = dateTimeService.minutesOf(open);
        const closeMin = dateTimeService.minutesOf(close);
        const crossesMidnight = closeMin <= openMin;
        if (crossesMidnight && closeMin > 0 && nowMin < closeMin) {
          return { isOpen: true, closesAt: yesterdayRow.close };
        }
      }
    }

    if (todayRow) {
      const open = dateTimeService.parseTimeOfDay(todayRow.open);
      if (open && nowMin < dateTimeService.minutesOf(open)) {
        return { isOpen: false, opensAt: todayRow.open };
      }
    }

    for (let offset = 1; offset <= 7; offset += 1) {
      const idx = (dayIdx + offset) % 7;
      const row = dateTimeService.rowForDay(rows, idx);
      if (!row) continue;
      return { isOpen: false, opensAt: `${row.open} ${dateTimeService.shortDayLabels[idx]}` };
    }

    return { isOpen: false };
  }
}

export default new OpenNowChipService();
