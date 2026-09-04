export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  RISK_OFFICER: 'RISK_OFFICER',
  MERCHANT_OPERATOR: 'MERCHANT_OPERATOR',
  SUPPORT_AGENT: 'SUPPORT_AGENT'
};

export const PERMISSIONS = {
  VIEW_METRICS: ['SUPER_ADMIN', 'RISK_OFFICER', 'MERCHANT_OPERATOR', 'SUPPORT_AGENT'],
  VIEW_CASES: ['SUPER_ADMIN', 'RISK_OFFICER', 'MERCHANT_OPERATOR', 'SUPPORT_AGENT'],
  TRIGGER_MANUAL_ACTION: ['SUPER_ADMIN', 'RISK_OFFICER', 'MERCHANT_OPERATOR'],
  VIEW_GUARDRAILS: ['SUPER_ADMIN', 'RISK_OFFICER', 'MERCHANT_OPERATOR'],
  UPDATE_POLICY_RULES: ['SUPER_ADMIN', 'RISK_OFFICER'],
  VIEW_AUDIT_LOGS: ['SUPER_ADMIN', 'RISK_OFFICER'],
  VIEW_MODELS: ['SUPER_ADMIN', 'RISK_OFFICER'],
  MANAGE_MODELS: ['SUPER_ADMIN', 'RISK_OFFICER'],
  MANAGE_SECRETS: ['SUPER_ADMIN']
};

export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (allowedRoles.includes(req.user.role) || req.user.role === ROLES.SUPER_ADMIN) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: Insufficient privileges for role '${req.user.role}'`
    });
  };
}

export function requirePermission(permission) {
  const allowed = PERMISSIONS[permission] || [];
  return requireRole(allowed);
}
