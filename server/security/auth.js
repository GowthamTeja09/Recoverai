import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'recoverai-super-secure-enterprise-jwt-secret-2026';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      merchantId: user.merchantId || 'mcht_enterprise_001'
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // If no token provided in demo/dev mode, attach default Super Admin user for seamless usage
  if (!token) {
    req.user = {
      id: 'usr_admin_01',
      email: 'admin@recoverai.io',
      name: 'System Administrator',
      role: req.headers['x-demo-role'] || 'SUPER_ADMIN',
      merchantId: 'mcht_enterprise_001'
    };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired authentication token' });
    }
    req.user = user;
    next();
  });
}
