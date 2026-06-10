/**
 * Shared, reference-counted "current time" ticker for the TodayHours islands.
 */
class TodayHoursClockService {
  /** Shared current time; updated once per second. */
  now = $state(new Date());

  constructor() {
    setInterval(() => {
      this.now = new Date();
    }, 60_000);
  }
}

const todayHoursClock = new TodayHoursClockService();
export default todayHoursClock;
