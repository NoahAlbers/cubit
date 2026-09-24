import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { RequestHandler, Response } from 'express';

const COOKIE = 'cubit-greeting';
const LIFETIME = 30 * 24 * 60 * 60 * 1000;
const COOLDOWN = 5 * 60 * 1000;

type KnownMember = { id: string; email: string };
type Options = {
  secret: string;
  workspace: string;
  secure: boolean;
  // This lookup is reached only after verifying the browser and matching its email.
  findFirstName: (id: string, email: string) => Promise<string | null>;
  now?: () => number;
};

export function createRememberedGreeting(options: Options) {
  const now = options.now || Date.now;
  // A separate purpose/workspace key and encrypted format: never an authentication JWT.
  const key = createHmac('sha256', options.secret)
    .update(`cubit:greeting:v1:${options.workspace}`)
    .digest();
  const emailDigest = (email: string) => createHmac('sha256', key).update(email).digest();
  // Single-process deployment, like login-limit.ts. Multiple replicas need a shared limiter.
  // Expired entries are pruned; at capacity, fail closed rather than evict active limits.
  const attempts = new Map<string, number>();

  function remember(res: Response, member: KnownMember) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const payload = JSON.stringify({
      id: member.id,
      email: emailDigest(member.email.trim().toLowerCase()).toString('hex'),
      expires: now() + LIFETIME,
    });
    const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
    const cookie = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
    res.cookie(COOKIE, cookie, {
      httpOnly: true,
      secure: options.secure,
      sameSite: 'strict',
      path: '/login/greeting',
      maxAge: LIFETIME,
    });
  }

  const greet: RequestHandler = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    const generic = () => res.status(200).json({ firstName: null });
    const time = now();
    for (const [ip, until] of attempts) if (until <= time) attempts.delete(ip);
    const ip = req.ip || 'unknown';
    if (attempts.has(ip) || attempts.size >= 10000) return void generic();
    attempts.set(ip, time + COOLDOWN);

    // All outcomes use the same envelope. No email-directory lookup on an unknown browser.
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254) return void generic();
    const cookie = req.headers.cookie
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    if (!cookie || cookie.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cookie)) return void generic();
    try {
      const bytes = Buffer.from(cookie, 'base64url');
      if (bytes.length < 29) return void generic();
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      const claims = JSON.parse(
        Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'),
      );
      if (
        typeof claims.id !== 'string' ||
        claims.id.length > 64 ||
        !Number.isFinite(claims.expires) ||
        claims.expires <= time ||
        claims.expires > time + LIFETIME ||
        typeof claims.email !== 'string' ||
        !/^[a-f0-9]{64}$/.test(claims.email) ||
        !timingSafeEqual(Buffer.from(claims.email, 'hex'), emailDigest(email))
      )
        return void generic();
      const storedName = await options.findFirstName(claims.id, email);
      // Only the first given-name token; no HTML, control characters, surname or profile data.
      const firstName = storedName?.normalize('NFC').trim().split(/\s+/)[0] || '';
      if (!/^[\p{L}][\p{L}\p{M}'’-]{0,39}$/u.test(firstName)) return void generic();
      res.status(200).json({ firstName });
    } catch {
      // Tampered/expired cookies and database failures must not disrupt signing in.
      generic();
    }
  };
  return { remember, greet };
}
