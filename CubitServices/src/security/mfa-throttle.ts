import { EntityManager } from 'typeorm';
import { AppDataSource } from '../database';
import { AccountThrottle } from '../entity/accountThrottle';

// Commit reservations independently of the authentication transaction: rejecting
// a code must not roll back its attempt count. Call only after validating the
// password or scoped recovery link, never for an arbitrary submitted account ID.
export async function reserveMfaAttempt(memberId: string) {
  const id = 'mfa:' + memberId;
  const result = await AppDataSource.transaction(async (manager) => {
    const now = Date.now();
    await manager
      .createQueryBuilder()
      .insert()
      .into(AccountThrottle)
      .values({ id, windowStart: new Date(now) })
      .orIgnore()
      .execute();
    const state = await manager.findOneOrFail(AccountThrottle, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (state.blockedUntil && state.blockedUntil.getTime() > now)
      return {
        retryAfter: Math.ceil((state.blockedUntil.getTime() - now) / 1000),
        revision: state.revision,
      };
    // A full day without an admitted attempt starts a new allowance. Requests
    // during cooldown do not extend it. Successful verification clears it.
    if (now - state.windowStart.getTime() >= 24 * 60 * 60 * 1000) {
      state.attempts = 0;
      state.level = 0;
    }
    state.attempts++;
    state.revision++;
    state.windowStart = new Date(now);
    if (state.attempts >= 5) {
      state.blockedUntil = new Date(
        now + Math.min(5 * 60 * 1000 * 2 ** state.level, 24 * 60 * 60 * 1000),
      );
      state.level = Math.min(state.level + 1, 9);
    }
    await manager.save(state);
    return { retryAfter: 0, revision: state.revision };
  });
  if (result.retryAfter)
    throw Object.assign(Error('Too many authenticator attempts. Wait before trying again.'), {
      status: 429,
      retryAfter: result.retryAfter,
    });
  return { id, revision: result.revision };
}

export async function clearMfaAttempts(
  manager: EntityManager,
  reservation: { id: string; revision: number },
) {
  // Do not clear an attempt admitted by another concurrent request.
  await manager.update(AccountThrottle, reservation, { attempts: 0, level: 0, blockedUntil: null });
}
