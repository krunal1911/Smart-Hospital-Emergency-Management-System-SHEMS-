// In-memory rate limiting middleware for public endpoints
const ipRequests = new Map(); // ip -> { count, resetTime }

export const emergencyRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute window
  const max = options.max || 30; // limit each IP to 30 requests per windowMs

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = ipRequests.get(ip);

    if (!record || now > record.resetTime) {
      ipRequests.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      return res.status(429).json({
        status: 'error',
        message: 'Too many emergency requests from this device/IP. Please wait a minute before retrying or call emergency emergency hotline (108).',
      });
    }

    record.count += 1;
    next();
  };
};
