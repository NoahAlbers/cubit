export let organizationTimeZone = 'America/New_York';
export function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return value.length <= 64 && !/^[+-]/.test(value);
  } catch {
    return false;
  }
}
export function setOrganizationTimeZone(value: string) {
  if (!validTimeZone(value)) throw Error('Invalid organization time zone.');
  organizationTimeZone = value;
}
export function zonedParts(date = new Date(), timeZone = organizationTimeZone) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
}
export function organizationDay(date = new Date(), timeZone = organizationTimeZone) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}
export function organizationTimestamp(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: organizationTimeZone,
    dateStyle: 'medium',
    timeStyle: 'long',
  }).format(new Date(date));
}
export function startOfOrganizationDay(day: string, timeZone = organizationTimeZone) {
  // Binary search the UTC interval for the first instant on/after this local day.
  // This also handles DST transitions whose midnight is skipped or repeated.
  let low = Date.parse(day + 'T00:00:00Z') - 2 * 86400000;
  let high = low + 4 * 86400000;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (organizationDay(new Date(mid), timeZone) < day) low = mid + 1;
    else high = mid;
  }
  return new Date(low);
}
