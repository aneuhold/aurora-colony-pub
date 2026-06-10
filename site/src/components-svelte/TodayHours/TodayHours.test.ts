import { cleanup, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import dateTimeService, { type HoursRow } from '$util/DateTime.service';
import { renderSvelteComponent } from '../../../testUtils/renderSvelteComponent';
import TodayHours from './TodayHours.svelte';

const weekly: HoursRow[] = [
  { label: 'Mon–Thu', open: '11:00 AM', close: '10:00 PM' },
  { label: 'Fri', open: '11:00 AM', close: '12:00 AM' },
  { label: 'Sat', open: '9:00 AM', close: '12:00 AM' },
  { label: 'Sun', open: '9:00 AM', close: '10:00 PM' }
];

const happyHour = { label: 'Mon–Fri', start: '3:00 PM', end: '6:00 PM' };

describe('TodayHours', () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the row covering the visitor's current day", () => {
    const todayRow = dateTimeService.rowForDay(weekly, new Date().getDay()) ?? weekly[0];
    renderSvelteComponent(TodayHours, { props: { weekly } });
    expect(screen.getByText(`${todayRow.open} – ${todayRow.close}`)).toBeInTheDocument();
  });

  it('shows the happy-hour line only on the days its label covers', () => {
    const coversToday = dateTimeService.labelCoversDay(happyHour.label, new Date().getDay());
    renderSvelteComponent(TodayHours, { props: { weekly, happyHour } });
    const happyHourLine = screen.queryByText(`Happy hour ${happyHour.start} – ${happyHour.end}`);
    if (coversToday) {
      expect(happyHourLine).toBeInTheDocument();
    } else {
      expect(happyHourLine).not.toBeInTheDocument();
    }
  });
});
