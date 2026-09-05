import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import express from 'express';
import { ROLES } from './rbac.js';

let runtimeDevSecret = null;

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable must be set in production');
  }

  // Generate a cryptographically secure ephemeral secret for non-production development
  if (!runtimeDevSecret) {
    runtimeDevSecret = crypto.randomBytes(32).toString('hex');
  }
  return runtimeDevSecret;
}

export function generateToken(user, options = {}) {
  return jwt.sign(
    {
      id: user.id || 'usr_default',
      email: user.email || 'user@recoverai.io',
      name: user.name || 'User',
      role: user.role || ROLES.SUPPORT_AGENT,
      merchantId: user.merchantId || 'mcht_enterprise_001'
    },
    getJwtSecret(),
    { expiresIn: options.expiresIn || '24h' }
  );
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const isProduction = process.env.NODE_ENV === 'production';
  const isDemoMode = (process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === true) && !isProduction;

  // 1. Missing Token Check
  if (!token) {
    if (!isDemoMode) {
      return res.status(401).json({
        error: 'Authentication required: Missing Bearer token'
      });
    }

    // In isolated development demo mode, assign a restricted demo user
    const requestedRole = String(req.headers['x-demo-role'] || 'SUPPORT_AGENT').toUpperCase();
    const validatedRole = Object.values(ROLES).includes(requestedRole) ? requestedRole : ROLES.SUPPORT_AGENT;

    req.user = {
      id: 'usr_demo_hackathon',
      email: 'demo@recoverai.io',
      name: 'Hackathon Demo User',
      role: validatedRole,
      merchantId: 'mcht_enterprise_001'
    };
    req.isDemo = true;
    return next();
  }

  // 2. Token Verification (role is strictly extracted from verified payload; x-demo-role is ignored)
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      merchantId: decoded.merchantId || 'mcht_enterprise_001'
    };
    req.isDemo = false;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired authentication token'
    });
  }
}

// Authentication router for issuing verified JWTs
export const authRouter = express.Router();

authRouter.post('/token', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDemoMode = (process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === true) && !isProduction;

  if (isProduction || !isDemoMode) {
    return res.status(403).json({ error: 'Token generation endpoint is disabled in production' });
  }

  const role = String(req.body.role || req.headers['x-demo-role'] || ROLES.SUPER_ADMIN).toUpperCase();
  const validRole = Object.values(ROLES).includes(role) ? role : ROLES.SUPPORT_AGENT;

  const user = {
    id: req.body.id || 'usr_admin_01',
    email: req.body.email || 'admin@recoverai.io',
    name: req.body.name || 'RecoverAI Administrator',
    role: validRole,
    merchantId: 'mcht_enterprise_001'
  };

  const token = generateToken(user);
  res.json({ success: true, token, user });
});
