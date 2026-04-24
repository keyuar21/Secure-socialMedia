const rateLimit = require('express-rate-limit');

// In development, use very high limits so testing is never blocked.
// In production, enforce strict limits.
const IS_DEV = process.env.NODE_ENV !== 'production';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: IS_DEV ? 500 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: IS_DEV ? 500 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP attempts. Please try again later.' },
});

const passwordResetLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: IS_DEV ? 500 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again later.' },
});

const postLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: IS_DEV ? 500 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many posts. Please slow down.' },
});

const commentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: IS_DEV ? 500 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many comments. Please slow down.' },
});

const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: IS_DEV ? 500 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many search requests. Please slow down.' },
});

module.exports = { loginLimiter, otpLimiter, passwordResetLimiter, postLimiter, commentLimiter, searchLimiter };

