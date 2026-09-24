import { RequestHandler } from 'express';
import { createHash } from 'crypto';

// Single-process review deployment. Bound memory and expire attempts by IP.
export function loginLimit(now: () => number = Date.now, capacity = 10000): RequestHandler {
  const attempts = new Map<string, { count: number; until: number }>();
  const accounts = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    if (req.path === '/greeting') return next();
    const time = now();
    for (const [key, entry] of attempts) if (entry.until <= time) attempts.delete(key);
    const key = req.ip || 'unknown';
    let entry = attempts.get(key);
    if (!entry) {
      if (attempts.size >= capacity) attempts.delete(attempts.keys().next().value!);
      entry = { count: 0, until: time + 15 * 60 * 1000 };
      attempts.set(key, entry);
    }
    if (++entry.count > 20) {
      res.setHeader('Retry-After', Math.ceil((entry.until - time) / 1000));
      return res
        .status(429)
        .json({ message: 'Too many sign-in attempts. Please try again later.' });
    }
    for (const [key, entry] of accounts) if (entry.until <= time) accounts.delete(key);
    const email =
      typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    if (email) {
      const accountKey = createHash('sha256').update(email).digest('hex');
      let account = accounts.get(accountKey);
      if (!account) {
        if (accounts.size >= capacity) accounts.delete(accounts.keys().next().value!);
        account = { count: 0, until: time + 5 * 60 * 1000 };
        accounts.set(accountKey, account);
      }
      if (account.count >= 10) {
        res.setHeader('Retry-After', Math.max(1, Math.ceil((account.until - time) / 1000)));
        return res
          .status(429)
          .json({ message: 'Too many sign-in attempts. Please try again later.' });
      }
      const current = account;
      res.once('finish', () => {
        if (res.statusCode === 401) {
          current.count++;
          if (current.count === 10) current.until = now() + 5 * 60 * 1000;
        } else if (res.statusCode >= 200 && res.statusCode < 300) accounts.delete(accountKey);
      });
    }
    next();
  };
}
