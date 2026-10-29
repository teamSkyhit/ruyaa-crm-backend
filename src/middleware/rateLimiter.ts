// src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  // Catalog GETs use publicReadLimiter. Leave tracking on this stricter bucket.
  skip: (req) => {
    if (req.method !== 'GET' || !req.path.startsWith('/api/public/')) return false;
    return !req.path.startsWith('/api/public/orders/track');
  },
});

// Public catalog reads. High enough for a storefront and a real load test,
// still capped per client. Writes stay on the tighter limiters.
export const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.PUBLIC_READ_RATE_LIMIT_MAX ?? 3000),
  message: { success: false, error: 'Too many requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export default limiter;

// Auth-specific: 5 requests per 15 minutes per IP (login, forgot-password, reset-password)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 5),
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public order creation: 10 orders per 15 minutes per IP
export const publicOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PUBLIC_ORDER_RATE_LIMIT_MAX ?? 10),
  message: { success: false, error: 'Too many orders submitted. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public leads (newsletter, enquiry): 5 per 15 minutes per IP
export const publicLeadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PUBLIC_LEAD_RATE_LIMIT_MAX ?? 5),
  message: { success: false, error: 'Too many requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Forgot-password: 3 per hour per IP (stricter — triggers email send)
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.FORGOT_PASSWORD_RATE_LIMIT_MAX ?? 3),
  message: { success: false, error: 'Too many password reset requests. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Reset-password: 10 per hour per IP
export const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.RESET_PASSWORD_RATE_LIMIT_MAX ?? 10),
  message: { success: false, error: 'Too many reset attempts. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public order tracking: 20 per 15 minutes per IP (prevents sequential enumeration)
export const publicTrackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PUBLIC_TRACK_RATE_LIMIT_MAX ?? 20),
  message: { success: false, error: 'Too many tracking requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});
