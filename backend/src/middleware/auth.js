const jwt = require('jsonwebtoken');
const { User, Tenant } = require('../models');

const sign = (payload, exp = '12h') => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: exp });

// tenantId always comes from the verified account, never from the request body.
async function requireUser(req, res, next) {
  try {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    const p = jwt.verify(t, process.env.JWT_SECRET);
    if (p.type !== 'user') return res.status(401).json({ error: 'Invalid session' });
    const user = await User.findById(p.id);
    if (!user || !user.active) return res.status(401).json({ error: 'Account disabled' });
    req.user = user; req.tenantId = user.tenantId; req.tenant = await Tenant.findById(user.tenantId);
    next();
  } catch { res.status(401).json({ error: 'Please sign in again' }); }
}
const requireManager = (req, res, next) =>
  req.user.role === 'MANAGER' ? next() : res.status(403).json({ error: 'Manager role required' });

function requireSuper(req, res, next) {
  try {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    const p = jwt.verify(t, process.env.JWT_SECRET);
    if (p.type !== 'super') throw new Error();
    next();
  } catch { res.status(401).json({ error: 'Super admin only' }); }
}
module.exports = { sign, requireUser, requireManager, requireSuper };
