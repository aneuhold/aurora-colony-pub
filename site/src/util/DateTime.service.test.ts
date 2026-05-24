import { describe, expect, it } from 'vitest';
import dateTimeService, { type HoursRow } from './DateTime.service';

const weekly: HoursRow[] = [
  { label: 'Mon–Thu', open: '11:00 AM', close: '10:00 PM' },
  { label: 'Fri', open: '11:00 AM', close: '12:00 AM' },
  { label: 'Sat', open: '9:00 AM', close: '12:00 AM' },
  { label: 'Sun', open: '9:00 AM', close: '10:00 PM' }
];

describe('dateTimeService.parseTimeOfDay', () => {
  it('parses morning times', () => {
    expect(dateTimeService.parseTimeOfDay('9:00 AM')).toEqual({ hour: 9, minute: 0 });
  });

  it('parses afternoon times into 24-hour clock', () => {
    expect(dateTimeService.parseTimeOfDay('3:30 PM')).toEqual({ hour: 15, minute: 30 });
  });

  it('treats 12:00 AM as midnight (hour 0)', () => {
    expect(dateTimeService.parseTimeOfDay('12:00 AM')).toEqual({ hour: 0, minute: 0 });
  });

  it('treats 12:00 PM as noon (hour 12)', () => {
    expect(dateTimeService.parseTimeOfDay('12:00 PM')).toEqual({ hour: 12, minute: 0 });
  });

  it('returns null for malformed input', () => {
    expect(dateTimeService.parseTimeOfDay('not a time')).toBeNull();
    expect(dateTimeService.parseTimeOfDay('25:00 AM')).toBeNull();
  });
});

describe('dateTimeService.minutesOf', () => {
  it('converts hour/minute to total minutes since midnight', () => {
    expect(dateTimeService.minutesOf({ hour: 0, minute: 0 })).toBe(0);
    expect(dateTimeService.minutesOf({ hour: 9, minute: 30 })).toBe(570);
    expect(dateTimeService.minutesOf({ hour: 23, minute: 59 })).toBe(1439);
  });
});

describe('dateTimeService.rowForDay', () => {
  it('finds a row covering a single-day label', () => {
    expect(dateTimeService.rowForDay(weekly, 5)).toEqual(weekly[1]); // Fri
  });

  it('finds a row covering an en-dash range label', () => {
    expect(dateTimeService.rowForDay(weekly, 2)).toEqual(weekly[0]); // Tue ∈ Mon–Thu
  });

  it('finds a row covering an ascii-hyphen range label', () => {
    const rows: HoursRow[] = [{ label: 'Mon-Thu', open: '11:00 AM', close: '10:00 PM' }];
    expect(dateTimeService.rowForDay(rows, 3)).toEqual(rows[0]); // Wed
  });

  it('finds a row covering a wrap-around range label', () => {
    const rows: HoursRow[] = [{ label: 'Sat–Mon', open: '9:00 AM', close: '10:00 PM' }];
    expect(dateTimeService.rowForDay(rows, 0)).toEqual(rows[0]); // Sun
  });

  it('returns undefined when no row covers the day', () => {
    const partial: HoursRow[] = [{ label: 'Mon–Fri', open: '11:00 AM', close: '10:00 PM' }];
    expect(dateTimeService.rowForDay(partial, 0)).toBeUndefined(); // Sun
  });

  it('returns undefined when the label is unrecognized', () => {
    const rows: HoursRow[] = [{ label: 'Funday', open: '9:00 AM', close: '10:00 PM' }];
    expect(dateTimeService.rowForDay(rows, 1)).toBeUndefined();
  });
});

describe('dateTimeService.shortDayLabel', () => {
  it('returns Sun for a Sunday', () => {
    expect(dateTimeService.shortDayLabel(new Date(2026, 0, 4))).toBe('Sun'); // 2026-01-04
  });

  it('returns Wed for a Wednesday', () => {
    expect(dateTimeService.shortDayLabel(new Date(2026, 0, 7))).toBe('Wed');
  });
});
