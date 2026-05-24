import { describe, expect, it } from 'vitest';
import openNowChipService, { type HoursRow } from './OpenNowChip.service';

const weekly: HoursRow[] = [
  { label: 'Mon–Thu', open: '11:00 AM', close: '10:00 PM' },
  { label: 'Fri', open: '11:00 AM', close: '12:00 AM' },
  { label: 'Sat', open: '9:00 AM', close: '12:00 AM' },
  { label: 'Sun', open: '9:00 AM', close: '10:00 PM' }
];

// Day indexes per JS Date.getDay: 0=Sun..6=Sat.
const at = (dayIdx: number, hour: number, minute: number): Date => {
  const d = new Date(2026, 0, 4); // 2026-01-04 is a Sunday
  d.setDate(d.getDate() + dayIdx); // shift to target weekday
  d.setHours(hour, minute, 0, 0);
  return d;
};

describe('openNowChipService.parseTimeOfDay', () => {
  it('parses morning times', () => {
    expect(openNowChipService.parseTimeOfDay('9:00 AM')).toEqual({ hour: 9, minute: 0 });
  });

  it('parses afternoon times into 24-hour clock', () => {
    expect(openNowChipService.parseTimeOfDay('3:30 PM')).toEqual({ hour: 15, minute: 30 });
  });

  it('treats 12:00 AM as midnight (hour 0)', () => {
    expect(openNowChipService.parseTimeOfDay('12:00 AM')).toEqual({ hour: 0, minute: 0 });
  });

  it('treats 12:00 PM as noon (hour 12)', () => {
    expect(openNowChipService.parseTimeOfDay('12:00 PM')).toEqual({ hour: 12, minute: 0 });
  });

  it('returns null for malformed input', () => {
    expect(openNowChipService.parseTimeOfDay('not a time')).toBeNull();
    expect(openNowChipService.parseTimeOfDay('25:00 AM')).toBeNull();
  });
});

describe('openNowChipService.expandLabel', () => {
  it('expands a single-day label', () => {
    expect(openNowChipService.expandLabel('Fri')).toEqual([5]);
  });

  it('expands an en-dash range', () => {
    expect(openNowChipService.expandLabel('Mon–Thu')).toEqual([1, 2, 3, 4]);
  });

  it('expands an ascii-hyphen range', () => {
    expect(openNowChipService.expandLabel('Mon-Thu')).toEqual([1, 2, 3, 4]);
  });

  it('expands a range that wraps the week', () => {
    expect(openNowChipService.expandLabel('Sat–Mon')).toEqual([6, 0, 1]);
  });
});

describe('openNowChipService.computeStatus', () => {
  it('reports open during normal weekday hours', () => {
    const status = openNowChipService.computeStatus(at(1, 14, 0), weekly); // Mon 2 PM
    expect(status).toEqual({ isOpen: true, closesAt: '10:00 PM' });
  });

  it('reports closed before the day starts', () => {
    const status = openNowChipService.computeStatus(at(1, 8, 0), weekly); // Mon 8 AM
    expect(status.isOpen).toBe(false);
    expect(status.opensAt).toBe('11:00 AM');
  });

  it('handles cross-midnight Friday — 11 PM is still open', () => {
    const status = openNowChipService.computeStatus(at(5, 23, 0), weekly); // Fri 11 PM
    expect(status).toEqual({ isOpen: true, closesAt: '12:00 AM' });
  });

  it('reports closed at Saturday 12:30 AM (Friday already closed)', () => {
    const status = openNowChipService.computeStatus(at(6, 0, 30), weekly); // Sat 0:30
    expect(status.isOpen).toBe(false);
    expect(status.opensAt).toBe('9:00 AM');
  });

  it('falls forward to next weekday when today is closed all day', () => {
    const customWeekly: HoursRow[] = [{ label: 'Mon–Fri', open: '11:00 AM', close: '10:00 PM' }];
    const status = openNowChipService.computeStatus(at(6, 13, 0), customWeekly); // Sat 1 PM
    expect(status.isOpen).toBe(false);
    expect(status.opensAt).toBe('11:00 AM Mon');
  });

  it('reports closed immediately after closing', () => {
    const status = openNowChipService.computeStatus(at(1, 22, 30), weekly); // Mon 10:30 PM
    expect(status.isOpen).toBe(false);
    expect(status.opensAt).toBe('11:00 AM Tue');
  });
});
