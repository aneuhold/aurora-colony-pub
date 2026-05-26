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

describe('dateTimeService.to24HourTime', () => {
  it('zero-pads single-digit morning hours', () => {
    expect(dateTimeService.to24HourTime('9:00 AM')).toBe('09:00');
  });

  it('converts afternoon times to 24-hour form', () => {
    expect(dateTimeService.to24HourTime('3:30 PM')).toBe('15:30');
  });

  it('returns "00:00" for midnight', () => {
    expect(dateTimeService.to24HourTime('12:00 AM')).toBe('00:00');
  });

  it('returns null for malformed input', () => {
    expect(dateTimeService.to24HourTime('not a time')).toBeNull();
  });
});

describe('dateTimeService.longDayNameForLabel', () => {
  it('returns one entry for a single-day label', () => {
    expect(dateTimeService.longDayNameForLabel('Fri')).toEqual(['Friday']);
  });

  it('expands an en-dash range', () => {
    expect(dateTimeService.longDayNameForLabel('Mon–Thu')).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday'
    ]);
  });

  it('handles a wrap-around range', () => {
    expect(dateTimeService.longDayNameForLabel('Sat–Mon')).toEqual([
      'Saturday',
      'Sunday',
      'Monday'
    ]);
  });

  it('returns [] for an unrecognized label', () => {
    expect(dateTimeService.longDayNameForLabel('Funday')).toEqual([]);
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

describe('dateTimeService.labelCoversDay', () => {
  it('returns true for a single-day label match', () => {
    expect(dateTimeService.labelCoversDay('Fri', 5)).toBe(true);
  });

  it('returns false for a single-day label miss', () => {
    expect(dateTimeService.labelCoversDay('Fri', 4)).toBe(false);
  });

  it('returns true for an en-dash range that covers the day', () => {
    expect(dateTimeService.labelCoversDay('Mon–Fri', 3)).toBe(true); // Wed
  });

  it('returns false for an en-dash range that does not cover the day', () => {
    expect(dateTimeService.labelCoversDay('Mon–Fri', 0)).toBe(false); // Sun
  });

  it('returns true for a wrap-around range that covers the day', () => {
    expect(dateTimeService.labelCoversDay('Sat–Mon', 0)).toBe(true); // Sun
  });

  it('returns false for an unrecognized label', () => {
    expect(dateTimeService.labelCoversDay('Funday', 1)).toBe(false);
  });
});

describe('dateTimeService.formatRelativeTime', () => {
  const now = new Date('2026-05-24T12:00:00.000Z');

  const cases: { label: string; iso: string; expected: string }[] = [
    {
      label: 'just now (under 60s)',
      iso: '2026-05-24T11:59:30.000Z',
      expected: 'Just now'
    },
    {
      label: 'minutes ago',
      iso: '2026-05-24T11:48:00.000Z',
      expected: '12m ago'
    },
    {
      label: 'hours ago',
      iso: '2026-05-24T09:00:00.000Z',
      expected: '3h ago'
    },
    {
      label: 'days ago (under the 14-day cutoff)',
      iso: '2026-05-22T12:00:00.000Z',
      expected: '2d ago'
    },
    {
      label: 'absolute date past the 14-day cutoff',
      iso: '2026-05-01T12:00:00.000Z',
      expected: 'May 1'
    }
  ];

  for (const { label, iso, expected } of cases) {
    it(label, () => {
      expect(dateTimeService.formatRelativeTime(iso, now)).toBe(expected);
    });
  }
});
