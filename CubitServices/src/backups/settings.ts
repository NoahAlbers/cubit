function fail(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}
export const defaultBackupSettings = {
  frequency: 'daily',
  time: '02:15',
  timezone: 'America/New_York',
  weekday: 0,
  monthday: 1,
  localKeep: 7,
  remoteKeep: 30,
  offsiteEnabled: false,
  verifyDays: 30,
};
export function validateBackupSettings(value: any) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('Choose valid backup settings.');
  if (Object.keys(value).some((k) => !Object.keys(defaultBackupSettings).includes(k)))
    fail('Unknown backup setting.');
  if (
    !['manual', 'daily', 'weekly', 'monthly'].includes(value.frequency) ||
    typeof value.time !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)
  )
    fail('Choose a valid frequency and time.');
  if (typeof value.timezone !== 'string' || value.timezone.length > 60)
    fail('Choose a valid time zone.');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.timezone }).format();
  } catch {
    fail('Choose a valid time zone.');
  }
  for (const [key, min, max] of [
    ['weekday', 0, 6],
    ['monthday', 1, 31],
    ['localKeep', 3, 365],
    ['remoteKeep', 3, 365],
    ['verifyDays', 0, 90],
  ] as const)
    if (!Number.isInteger(value[key]) || value[key] < min || value[key] > max)
      fail(`Invalid ${key} value.`);
  if (typeof value.offsiteEnabled !== 'boolean')
    fail('Choose whether off-server copies are enabled.');
  return Object.fromEntries(
    Object.keys(defaultBackupSettings).map((k) => [k, value[k]]),
  ) as typeof defaultBackupSettings;
}
