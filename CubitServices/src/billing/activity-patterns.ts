import { organizationTimeZone } from '../organization/time';
export { organizationTimeZone as activityTimeZone } from '../organization/time';
const calendar = () =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: organizationTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  });
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function localAccessEntries(logs: any[], from: string, to: string, now = new Date()) {
  const earliest = Date.parse(from + 'T00:00:00Z') - 86400000,
    latest = Math.min(+now, Date.parse(to + 'T00:00:00Z') + 2 * 86400000);
  return logs.flatMap((event) => {
    const stamp = new Date(event.timestamp);
    if (!Number.isFinite(+stamp) || +stamp < earliest || +stamp > latest || +stamp > +now)
      return [];
    const p = Object.fromEntries(
      calendar()
        .formatToParts(stamp)
        .map((part) => [part.type, part.value]),
    );
    const date = `${p.year}-${p.month}-${p.day}`;
    return date >= from && date <= to
      ? [{ event, date, hour: Number(p.hour), weekday: weekdays.indexOf(p.weekday) }]
      : [];
  });
}

export function busiestTimes(
  entries: ReturnType<typeof localAccessEntries>,
  from: string,
  to: string,
) {
  const weekHours = weekdays.map((label) => ({ label, values: Array<number>(24).fill(0) }));
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const months = new Map<
    number,
    { label: string; values: (number | null)[]; samples: number[]; totals: number[] }
  >();
  // Count every included calendar date, including dates with zero visits. A
  // partial month or leap day only contributes when that actual date is included.
  for (
    let d = new Date(from + 'T00:00:00Z');
    d.toISOString().slice(0, 10) <= to;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const month = d.getUTCMonth(),
      day = d.getUTCDate() - 1;
    if (!months.has(month))
      months.set(month, {
        label: names[month],
        values: Array(31).fill(null),
        samples: Array(31).fill(0),
        totals: Array(31).fill(0),
      });
    months.get(month)!.samples[day]++;
  }
  let total = 0;
  for (const entry of entries) {
    if (!entry.event.accessGranted) continue;
    weekHours[entry.weekday].values[entry.hour]++;
    const month = months.get(Number(entry.date.slice(5, 7)) - 1);
    if (month) month.totals[Number(entry.date.slice(8, 10)) - 1]++;
    total++;
  }
  const monthDays = [...months.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => ({
      ...row,
      values: row.samples.map((count, i) => (count ? row.totals[i] / count : null)),
    }));
  return { timeZone: organizationTimeZone, total, weekHours, monthDays };
}
