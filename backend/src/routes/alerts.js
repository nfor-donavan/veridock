const router = require('express').Router();
const { Alert } = require('../models');
const { requireUser } = require('../middleware/auth');
router.use(requireUser);

router.get('/', async (req, res) => {
  const alerts = await Alert.find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).limit(30);
  res.json({ alerts, unread: alerts.filter(a => !a.read).length, myPhone: req.user.phone || '' });
});
router.post('/read-all', async (req, res) => { await Alert.updateMany({ tenantId: req.tenantId, read: false }, { read: true }); res.json({ ok: true }); });
module.exports = router;
