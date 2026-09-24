import { RequestHandler } from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { demoAudience, demoEmail } from './identity';

// An unverified audience is ONLY a routing hint. The separate demo service
// verifies the signature with its own key before accessing its own database.
// Fail closed: a demo request must never fall through to the review handlers.
export function demoProxy(enabled: boolean, port = 5002): RequestHandler {
  return (req, res, next) => {
    const login = req.method === 'POST' && /^\/login\/?$/.test(req.path);
    let demo =
      login &&
      (req.body?.workspace === 'demo' ||
        (typeof req.body?.email === 'string' && req.body.email.trim().toLowerCase() === demoEmail));
    // Always route login by the submitted identity, not a leftover session token.
    if (!login) {
      const token = req.headers.authorization?.match(/^Bearer (.{1,8192})$/)?.[1];
      try {
        const claims = token ? jwt.decode(token) : null;
        demo =
          !!claims &&
          typeof claims !== 'string' &&
          (claims.aud === demoAudience ||
            (Array.isArray(claims.aud) && claims.aud.includes(demoAudience)));
      } catch {
        /* Invalid tokens are rejected by the ordinary auth middleware. */
      }
      if (req.method === 'POST' && /^\/api\/account\/redeem\/?$/.test(req.path))
        demo = typeof req.body?.token === 'string' && req.body.token.startsWith('d.');
    }
    if (!demo) return next();
    res.setHeader('Cache-Control', 'no-store');
    if (!enabled)
      return res.status(503).json({ message: 'The synthetic demo is temporarily unavailable.' });
    const binary = req.headers['content-type'] === 'application/octet-stream';
    const body =
      binary || ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body || {});
    const headers: http.OutgoingHttpHeaders = {
      accept: req.headers.accept || 'application/json',
      'x-forwarded-for': req.ip,
    };
    for (const key of ['authorization', 'x-cubit-filename'])
      if (req.headers[key]) headers[key] = req.headers[key];
    if (binary) {
      headers['content-type'] = 'application/octet-stream';
      if (req.headers['content-length']) headers['content-length'] = req.headers['content-length'];
    }
    if (body) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(body);
    }
    const upstream = http.request(
      { hostname: '127.0.0.1', port, path: req.originalUrl, method: req.method, headers },
      (response) => {
        res.status(response.statusCode || 502);
        for (const key of ['content-type', 'content-disposition', 'retry-after'])
          if (response.headers[key]) res.setHeader(key, response.headers[key]!);
        response.on('error', () => res.destroy());
        response.pipe(res);
      },
    );
    upstream.setTimeout(30000, () => upstream.destroy(new Error('Demo timeout')));
    upstream.on('error', () => {
      if (!res.headersSent)
        res.status(503).json({ message: 'The synthetic demo is temporarily unavailable.' });
      else res.destroy();
    });
    res.on('close', () => upstream.destroy());
    if (binary) req.pipe(upstream);
    else upstream.end(body);
  };
}
