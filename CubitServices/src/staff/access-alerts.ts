export type AlertPreferences = {
  enabled: boolean;
  unknownFobs: boolean;
  refusedFobs: boolean;
  dedupeMinutes: number;
};
export type AlertScan = {
  id: string;
  fob: string;
  outcome: 'unknown' | 'refused' | 'granted';
  at: number;
};
export const defaultPreferences: AlertPreferences = {
  enabled: false,
  unknownFobs: false,
  refusedFobs: false,
  dedupeMinutes: 15,
};
// No transport, worker, or production ingestion is enabled in this release.
// This pure planner is shared by the preference preview and future delivery work.
// Each recipient needs their own persisted suppression state when delivery is added.
export function planAccessAlerts(preferences: AlertPreferences, scans: AlertScan[]) {
  const last = new Map<string, number>(),
    seen = new Set<string>();
  return [...scans]
    .sort((a, b) => a.at - b.at)
    .map((scan) => {
      const key = scan.outcome + ':' + scan.fob.trim().toUpperCase();
      let decision = 'Would alert';
      if (scan.outcome === 'granted') decision = 'Successful entry — no email';
      else if (
        !preferences.enabled ||
        !(scan.outcome === 'unknown' ? preferences.unknownFobs : preferences.refusedFobs)
      )
        decision = 'Not selected in your preferences';
      else if (
        seen.has(scan.id) ||
        (last.has(key) && scan.at - last.get(key)! < preferences.dedupeMinutes * 60000)
      )
        decision = 'Duplicate suppressed';
      else last.set(key, scan.at);
      seen.add(scan.id);
      return { ...scan, decision };
    });
}
