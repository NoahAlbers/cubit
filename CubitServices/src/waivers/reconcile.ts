import { AppDataSource } from '../database';
import { WaiverSignature } from '../entity/waiver';
import { docusealConfig } from './docuseal';
import { syncSigning } from './store';

// Completion is checked server-to-server; a browser callback cannot mark a waiver signed.
// Failures leave the request available for retry and never discard original files.
export function startWaiverReconciliation() {
  if (!docusealConfig().enabled) return () => {};
  let running = false,
    stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const pending = await AppDataSource.manager
        .createQueryBuilder(WaiverSignature, 's')
        .where("s.provider='docuseal' AND s.status IN ('Pending','Preparing','Needs review')")
        .orderBy('s.createdAt', 'ASC')
        .getMany();
      for (const s of pending) {
        if (stopped) break;
        try {
          await syncSigning(s.memberId, s.id);
        } catch {
          console.warn('Waiver archival pending; will retry:', s.id);
        }
      }
    } catch {
      console.warn('Waiver reconciliation unavailable; will retry.');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, 5 * 60 * 1000);
  timer.unref();
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
