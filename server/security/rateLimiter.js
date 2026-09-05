/**
 * In-memory sliding-window rate limiter middleware.
 * Protects endpoints from request flooding, API quota exhaustion, and denial of service.
 */
export function createRateLimiter({ windowMs = 60000, max = 60, message = 'Too many requests, please try again later.' } = {}) {
  const hits = new Map(); // ip -> array of timestamps

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();
    const windowStart = now - windowMs;

    let timestamps = hits.get(ip) || [];
    // Filter out timestamps older than the window
    timestamps = timestamps.filter(ts => ts > windowStart);

    if (timestamps.length >= max) {
      const oldestHit = timestamps[0];
      const retryAfterSec = Math.ceil((oldestHit + windowMs - now) / 1000);
      res.setHeader('Retry-After', Math.max(1, retryAfterSec));
      return res.status(429).json({
        error: message,
        retryAfterSeconds: Math.max(1, retryAfterSec)
      });
    }

    timestamps.push(now);
    hits.set(ip, timestamps);

    // Periodic cleanup if map grows too large
    if (hits.size > 10000) {
      for (const [k, v] of hits.entries()) {
        const active = v.filter(ts => ts > windowStart);
        if (active.length === 0) hits.delete(k);
        else hits.set(k, active);
      }
    }

    next();
  };
}

export const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'API rate limit exceeded. Please throttle your requests.'
});

export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Webhook ingestion rate limit exceeded. Please throttle incoming events.'
});

export const simulatorRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Simulation endpoint rate limit exceeded.'
});
