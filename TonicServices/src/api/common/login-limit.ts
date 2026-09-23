import { RequestHandler } from 'express'

// Single-process review deployment. Bound memory and expire attempts by IP.
export function loginLimit(now: () => number = Date.now): RequestHandler {
  const attempts = new Map<string, { count: number; until: number }>()
  return (req, res, next) => {
    const time = now()
    for (const [key, entry] of attempts) if (entry.until <= time) attempts.delete(key)
    const key = req.ip || 'unknown'
    let entry = attempts.get(key)
    if (!entry) {
      if (attempts.size >= 10000) return res.status(429).json({ message: 'Please try again later.' })
      entry = { count: 0, until: time + 15 * 60 * 1000 }
      attempts.set(key, entry)
    }
    if (++entry.count > 20) {
      res.setHeader('Retry-After', Math.ceil((entry.until - time) / 1000))
      return res.status(429).json({ message: 'Too many sign-in attempts. Please try again later.' })
    }
    next()
  }
}
