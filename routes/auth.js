const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/user');
const crypto = require('crypto');

const router = express.Router();

const loginAttempts = new Map();
const ATTEMPT_LIMIT = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || [];
  const recent = attempts.filter((t) => now - t < ATTEMPT_WINDOW_MS);

  if (recent.length >= ATTEMPT_LIMIT) {
    return false;
  }

  loginAttempts.set(ip, [...recent, now]);
  return true;
}

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail({ gmail_remove_dots: false }),
    body('password').isLength({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many login attempts' });
    }

    try {
      const user = await User.findOne({ email: req.body.email });
      if (!user || !(await user.verifyPassword(req.body.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      req.session.user = { _id: user._id, email: user.email, role: user.role };
      res.json({ success: true, user: req.session.user });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

router.get('/me', (req, res) => {
  if (req.session?.user) {
    return res.json({ user: req.session.user });
  }
  res.json({ user: null });
});

router.patch(
  '/password',
  [
    body('currentPassword').isLength({ min: 1 }),
    body('newPassword').isLength({ min: 1 }),
  ],
  async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    try {
      const user = await User.findById(req.session.user._id);
      if (!user || !(await user.verifyPassword(req.body.currentPassword))) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      user.passwordHash = await User.hashPassword(req.body.newPassword);
      await user.save();
      res.json({ success: true, message: 'Password updated' });
    } catch (err) {
      console.error('Password change error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.get('/csrf-token', (req, res) => {
  if (!req.session._csrf) {
    req.session._csrf = crypto.randomBytes(32).toString('hex');
  }
  res.json({ csrfToken: req.session._csrf });
});

function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.role === 'admin') return next();
  return res.status(403).json({ error: 'Forbidden' });
}

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
