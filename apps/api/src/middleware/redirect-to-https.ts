import type { Request, Response, NextFunction } from 'express';

/**
 * Redirects plain HTTP requests to HTTPS. Requests that already arrived over
 * TLS, or through a reverse proxy that set `X-Forwarded-Proto: https` (requires
 * the `trust proxy` setting), pass through untouched.
 */
export function redirectHttpToHttps(req: Request, res: Response, next: NextFunction): void {
  const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  if (req.secure || forwardedProto === 'https') {
    next();
    return;
  }
  const host = req.headers.host ?? '';
  res.redirect(301, `https://${host}${req.originalUrl}`);
}
