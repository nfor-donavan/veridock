const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User, Tenant, GlobalSuperAdmin } = require('../models');
const { sign, requireSuper, requireUser, requireManager } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() });
  if (!user || !user.active || !(await bcrypt.compare(req.body.password || '', user.passwordHash)))
    return res.status(401).json({ error: 'Email or password is incorrect' });
  const tenant = await Tenant.findById(user.tenantId);
  res.json({ token: sign({ type: 'user', id: user._id }), user: { name: user.name, role: user.role }, agency: tenant.agencyName, port: tenant.port });
});

router.post('/super-login', async (req, res) => {
  const a = await GlobalSuperAdmin.findOne({ email: String(req.body.email || '').toLowerCase() });
  if (!a || !(await bcrypt.compare(req.body.password || '', a.passwordHash))) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: sign({ type: 'super', id: a._id }, '2h') });
});

// Platform owner onboards a new transit agency and its first manager
router.post('/admin/tenants', requireSuper, async (req, res) => {
  try {
    const { agencyName, licenceNumber, port, managerName, managerEmail, managerPassword } = req.body;
    const tenant = await Tenant.create({ agencyName, licenceNumber, port });
    const manager = await User.create({ tenantId: tenant._id, name: managerName, email: managerEmail, role: 'MANAGER', passwordHash: await bcrypt.hash(managerPassword, 10) });
    res.status(201).json({ tenant, manager: { id: manager._id, email: manager.email } });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// A manager adds staff to their own agency
router.post('/users', requireUser, requireManager, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const u = await User.create({ tenantId: req.tenantId, name, email, role: role === 'MANAGER' ? 'MANAGER' : 'AGENT', passwordHash: await bcrypt.hash(password, 10) });
    res.status(201).json({ id: u._id, email: u.email, role: u.role });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
module.exports = router;
