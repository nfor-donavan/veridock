const router = require('express').Router();
const multer = require('multer');
const { Consignment, SmsLog, MILESTONES, MILESTONE_LABELS } = require('../models');
const { requireUser, requireManager } = require('../middleware/auth');
const { saveProof } = require('../services/storage');
const { calcDemurrage, DEFAULT_TARIFF } = require('../services/demurrage');
const { sendSms, normalizePhone, progressMessage } = require('../services/sms');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
router.use(requireUser);
const out = (c, req) => ({ ...c.toJSON(), riskLevel: c.computeRisk(), demurrage: calcDemurrage(c, req.tenant.tariff) });

// Every query below is scoped by req.tenantId (from the verified token).
router.get('/', async (req, res) => {
  const list = await Consignment.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
  // Risk is recomputed live so a stale stored value never reaches the dashboard
  res.json(list.map(c => ({ ...out(c, req), milestoneHistory: undefined })));
});

router.get('/stats', async (req, res) => {
  const list = await Consignment.find({ tenantId: req.tenantId });
  const s = { total: list.length, SAFE: 0, WARNING: 0, CRITICAL_RISK: 0, FINES_ACCUMULATING: 0, CLEARED: 0 };
  s.estMin = 0; s.estMax = 0;
  list.forEach(c => { s[c.computeRisk()]++; const d = calcDemurrage(c, req.tenant.tariff); s.estMin += d.estMin; s.estMax += d.estMax; });
  res.json(s);
});


// Tariff used to estimate demurrage. Everyone can read it; only managers can change it.
router.get('/tariff', (req, res) => res.json(req.tenant.tariff || DEFAULT_TARIFF));
router.put('/tariff', requireManager, async (req, res) => {
  const b = req.body, rates = {};
  for (const k of ['20DRY', '40DRY', '40HC']) {
    const min = Number(b.rates?.[k]?.min), max = Number(b.rates?.[k]?.max);
    if (!(min >= 0) || !(max >= min)) return res.status(400).json({ error: `Check the rates for ${k}: the maximum must be at least the minimum.` });
    rates[k] = { min, max };
  }
  const tier2StartDay = Number(b.tier2StartDay), tier2Multiplier = Number(b.tier2Multiplier);
  if (!(tier2StartDay > 0) || !(tier2Multiplier >= 1)) return res.status(400).json({ error: 'Extended-stay start day and multiplier are not valid.' });
  const tariff = { tier2StartDay, tier2Multiplier, rates };
  await require('../models').Tenant.updateOne({ _id: req.tenantId }, { $set: { tariff } });
  res.json(tariff);
});

// Agency analytics: where time is lost, which lines and staff drive it, and demurrage exposure.
router.get('/analytics', async (req, res) => {
  const list = await Consignment.find({ tenantId: req.tenantId });
  const stageSum = {}, stageN = {}, lines = {}, staff = {};
  let clearedDays = 0, cleared = 0, overDays = 0, overFiles = 0, expMin = 0, expMax = 0;
  for (const c of list) {
    // Latest ADVANCE entry per milestone, so reversals do not distort timings
    const latest = new Map();
    c.milestoneHistory.filter(h => h.action === 'ADVANCE').forEach(h => latest.set(h.milestone, h));
    let prev = c.arrivalDate;
    for (const m of MILESTONES.slice(1)) {
      const h = latest.get(m); if (!h) break;
      const days = Math.max(0, (h.updatedAt - prev) / 86400000);
      stageSum[m] = (stageSum[m] || 0) + days; stageN[m] = (stageN[m] || 0) + 1; prev = h.updatedAt;
    }
    c.milestoneHistory.filter(h => h.action === 'ADVANCE').forEach(h => { staff[h.updatedByName] = (staff[h.updatedByName] || 0) + 1; });
    const L = (lines[c.shippingLine] = lines[c.shippingLine] || { shippingLine: c.shippingLine, containers: 0, cleared: 0, days: 0, overDays: 0, estMin: 0, estMax: 0 });
    L.containers++;
    const dm = calcDemurrage(c, req.tenant.tariff); expMin += dm.estMin; expMax += dm.estMax; L.estMin += dm.estMin; L.estMax += dm.estMax;
    if (c.riskLevel !== 'CLEARED' && c.computeRisk() !== 'CLEARED') { /* open file */ } else { cleared++; clearedDays += c.daysElapsed; L.cleared++; L.days += c.daysElapsed; }
    if (c.daysRemaining < 0) { overDays += -c.daysRemaining; overFiles++; L.overDays += -c.daysRemaining; }
  }
  const stages = MILESTONES.slice(1).map(m => ({ key: m, label: MILESTONE_LABELS[m], avgDays: stageN[m] ? +(stageSum[m] / stageN[m]).toFixed(1) : null, samples: stageN[m] || 0 }));
  const measured = stages.filter(s => s.avgDays !== null);
  const bottleneck = measured.length ? measured.reduce((a, b) => (b.avgDays > a.avgDays ? b : a)) : null;
  res.json({
    totals: { containers: list.length, cleared, avgClearanceDays: cleared ? +(clearedDays / cleared).toFixed(1) : null, filesWithFines: overFiles, demurrageDays: overDays, estMin: expMin, estMax: expMax },
    stages, bottleneck,
    shippingLines: Object.values(lines).map(l => ({ ...l, avgDays: l.cleared ? +(l.days / l.cleared).toFixed(1) : null })).sort((a, b) => b.containers - a.containers),
    staff: Object.entries(staff).map(([name, milestones]) => ({ name, milestones })).sort((a, b) => b.milestones - a.milestones)
  });
});

// Record or correct the CAMCIS declaration reference. Agents may set it once; only managers may change it.
router.patch('/:id/camcis', async (req, res) => {
  const c = await Consignment.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!c) return res.status(404).json({ error: 'Consignment not found' });
  const ref = String(req.body.camcisReference || '').trim();
  if (ref.length < 5) return res.status(400).json({ error: 'Enter the full CAMCIS reference.' });
  if (c.camcisReference && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'Only a manager can change a recorded CAMCIS reference.' });
  c.camcisReference = ref; await c.save(); res.json(c);
});

router.get('/:id', async (req, res) => {
  const c = await Consignment.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!c) return res.status(404).json({ error: 'Consignment not found' });
  res.json(out(c, req));
});

router.post('/', async (req, res) => {
  try {
    const b = req.body;
    const c = await Consignment.create({
      tenantId: req.tenantId, billOfLading: b.billOfLading, containerNumber: b.containerNumber, camcisReference: b.camcisReference || undefined, containerType: b.containerType || '20DRY',
      importerName: b.importerName, importerPhone: normalizePhone(b.importerPhone), shippingLine: b.shippingLine,
      port: b.port, demurrageFreeDays: Number(b.demurrageFreeDays), arrivalDate: b.arrivalDate
    });
    res.status(201).json(c);
  } catch (e) {
    res.status(e.code === 11000 ? 409 : 400).json({ error: e.code === 11000 ? 'This bill of lading already exists in your agency.' : e.message });
  }
});

// Anti-falsification: next milestone only, and the proof file is mandatory or the state change is blocked.
router.post('/:id/advance', upload.single('proof'), async (req, res) => {
  try {
    const c = await Consignment.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!c) return res.status(404).json({ error: 'Consignment not found' });
    const idx = MILESTONES.indexOf(c.currentMilestone);
    if (idx === MILESTONES.length - 1) return res.status(400).json({ error: 'Already at the final milestone.' });
    const proof = await saveProof(req.file, req.tenantId);
    const next = MILESTONES[idx + 1];
    c.currentMilestone = next;
    if (next === 'GATE_PASS_ISSUED') c.exitedAt = new Date();
    c.milestoneHistory.push({ milestone: next, action: 'ADVANCE', updatedBy: req.user._id, updatedByName: req.user.name,
      proofDocumentUrl: proof.url, proofSha256: proof.sha256, proofMime: proof.mime, notes: req.body.notes });
    await c.save();
    // Non-blocking so a gateway outage never stalls port operations
    sendSms({ tenantId: c.tenantId, consignmentId: c._id, to: c.importerPhone, body: progressMessage(c, MILESTONE_LABELS[next]) }).catch(console.error);
    res.json(c);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// Corrections are audited, manager-only, and need a written reason.
router.post('/:id/revert', requireManager, async (req, res) => {
  const c = await Consignment.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!c) return res.status(404).json({ error: 'Consignment not found' });
  if (!req.body.reason || req.body.reason.length < 10) return res.status(400).json({ error: 'Give a reason of at least 10 characters.' });
  const idx = MILESTONES.indexOf(c.currentMilestone);
  if (idx === 0) return res.status(400).json({ error: 'Already at the first milestone.' });
  c.milestoneHistory.push({ milestone: c.currentMilestone, action: 'REVERT', updatedBy: req.user._id, updatedByName: req.user.name, notes: req.body.reason });
  c.currentMilestone = MILESTONES[idx - 1]; c.exitedAt = undefined;
  await c.save(); res.json(c);
});

router.get('/:id/sms', async (req, res) =>
  res.json(await SmsLog.find({ tenantId: req.tenantId, consignmentId: req.params.id }).sort({ createdAt: -1 }).limit(20)));
module.exports = router;
