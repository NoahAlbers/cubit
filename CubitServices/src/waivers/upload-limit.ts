import { RequestHandler } from 'express';
import { AppDataSource } from '../database';
import { AccountThrottle } from '../entity/accountThrottle';
import { Member } from '../entity/member';

// Reserve an attempt before reading the file body. Failed/invalid uploads count,
// and changing email, restarting a worker or using another IP cannot reset it.
export const limitWaiverUploads: RequestHandler = async (req, res, next) => {
  try {
    const now = Date.now(),
      windowMs = 15 * 60 * 1000;
    const retryAfter = await AppDataSource.transaction(async (manager) => {
      await manager.findOneOrFail(Member, {
        where: { id: req.member!.id },
        lock: { mode: 'pessimistic_write' },
      });
      const id = 'upload:' + req.member!.id;
      let state = await manager.findOneBy(AccountThrottle, { id });
      if (!state || now - state.windowStart.getTime() >= windowMs)
        state = manager.create(AccountThrottle, {
          id,
          attempts: 0,
          level: 0,
          revision: 0,
          windowStart: new Date(now),
          blockedUntil: null,
        });
      if (state.attempts >= 10)
        return Math.max(1, Math.ceil((state.windowStart.getTime() + windowMs - now) / 1000));
      state.attempts++;
      await manager.save(state);
      return 0;
    });
    if (retryAfter)
      return res
        .set('Retry-After', String(retryAfter))
        .status(429)
        .json({ message: 'Too many uploads. Try again after the upload window resets.' });
    next();
  } catch (error) {
    next(error);
  }
};
