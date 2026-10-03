const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User, Tenant, GlobalSuperAdmin, Consignment } = require('../models');
const { sign, requireSuper, requireUser, requireManager } = require('../middleware/auth');
const { normalizePhone } = require('../services/sms');

router.post('/login', async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() });
  if (!user || !user.active || !(await bcrypt.compare(req.body.password || '', user.passwordHash)))
    return res.status(401).json({ error: 'Email or password is incorrect' });
  const tenant = await Tenant.findById(user.tenantId);
  if (!tenant || tenant.active === false) return res.status(401).json({ error: 'This agency account is suspended.' });
  res.json({ token: sign({ type: 'user', id: user._id }), user: { name: user.name, role: user.role }, agency: tenant.agencyName, port: tenant.port });
});

router.post('/super-login', async (req, res) => {
  const a = await GlobalSuperAdmin.findOne({ email: String(req.body.email || '').toLowerCase() });
  if (!a || !(await bcrypt.compare(req.body.password || '', a.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect' });
  res.json({ token: sign({ type: 'super', id: a._id }, '2h') });
});

// ---- Platform owner: manage agencies ----
router.get('/admin/tenants', requireSuper, async (req, res) => {
  const tenants = await Tenant.find().sort({ createdAt: -1 });
  res.json(await Promise.all(tenants.map(async t => ({
    _id: t._id, agencyName: t.agencyName, licenceNumber: t.licenceNumber, port: t.port, active: t.active !== false, createdAt: t.createdAt,
    users: await User.countDocuments({ tenantId: t._id }), containers: await Consignment.countDocuments({ tenantId: t._id }),
    managers: (await User.find({ tenantId: t._id, role: 'MANAGER' }).select('email')).map(u => u.email)
  }))));
});
router.post('/admin/tenants', requireSuper, async (req, res) => {
  try {
    const { agencyName, licenceNumber, port, managerName, managerEmail, managerPassword, managerPhone } = req.body;
    if (!managerPassword || managerPassword.length < 8) return res.status(400).json({ error: 'The manager password needs at least 8 characters.' });
    const tenant = await Tenant.create({ agencyName, licenceNumber, port });
    const manager = await User.create({ tenantId: tenant._id, name: managerName, email: managerEmail, role: 'MANAGER', phone: managerPhone ? normalizePhone(managerPhone) : undefined, passwordHash: await bcrypt.hash(managerPassword, 10) });
    res.status(201).json({ tenant, manager: { id: manager._id, email: manager.email } });
  } catch (e) { res.status(e.code === 11000 ? 409 : 400).json({ error: e.code === 11000 ? 'That licence number or email already exists.' : e.message }); }
});
router.patch('/admin/tenants/:id', requireSuper, async (req, res) => {
  const t = await Tenant.findByIdAndUpdate(req.params.id, { active: !!req.body.active }, { new: true });
  if (!t) return res.status(404).json({ error: 'Agency not found' });
  res.json({ _id: t._id, active: t.active });
});
router.post('/admin/reset-password', requireSuper, async (req, res) => {
  if (!req.body.password || req.body.password.length < 8) return res.status(400).json({ error: 'The password needs at least 8 characters.' });
  const u = await User.findOneAndUpdate({ email: String(req.body.email || '').toLowerCase() }, { passwordHash: await bcrypt.hash(req.body.password, 10) });
  if (!u) return res.status(404).json({ error: 'No user with that email' });
  res.json({ ok: true });
});

// ---- Agency staff ----
router.post('/users', requireUser, requireManager, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const u = await User.create({ tenantId: req.tenantId, name, email, role: role === 'MANAGER' ? 'MANAGER' : 'AGENT', passwordHash: await bcrypt.hash(password, 10) });
    res.status(201).json({ id: u._id, email: u.email, role: u.role });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.patch('/me', requireUser, async (req, res) => {
  req.user.phone = req.body.phone ? normalizePhone(req.body.phone) : undefined; await req.user.save();
  res.json({ phone: req.user.phone || '' });
});
module.exports = router;
