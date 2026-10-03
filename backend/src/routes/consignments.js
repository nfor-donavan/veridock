const router = require('express').Router();
const multer = require('multer');
const { Consignment, SmsLog, Tenant, MILESTONES, MILESTONE_LABELS } = require('../models');
const { requireUser, requireManager } = require('../middleware/auth');
const { saveProof } = require('../services/storage');
const { inspectProof } = require('../services/proofCheck');
const { sendSms, normalizePhone, progressMessage } = require('../services/sms');
const { calcDemurrage, DEFAULT_TARIFF } = require('../services/demurrage');
const { evaluateRisk, alertProofReview } = require('../services/alerts');
const { buildReport } = require('../services/report');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const TYPES = ['20DRY', '40DRY', '40HC'];
router.use(requireUser);
const out = (c, req) => ({ ...c.toJSON(), riskLevel: c.computeRisk(), demurrage: calcDemurrage(c, req.tenant.tariff) });
const find = (req) => Consignment.findOne({ _id: req.params.id, tenantId: req.tenantId });

// Every query is scoped by req.tenantId (from the verified token).
router.get('/', async (req, res) => {
  const list = await Consignment.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
  res.json(list.map(c => ({ ...out(c, req), milestoneHistory: undefined })));
});

router.get('/stats', async (req, res) => {
  const list = await Consignment.find({ tenantId: req.tenantId });
  const s = { total: list.length, SAFE: 0, WARNING: 0, CRITICAL_RISK: 0, FINES_ACCUMULATING: 0, CLEARED: 0, estMin: 0, estMax: 0 };
  list.forEach(c => { s[c.computeRisk()]++; const d = calcDemurrage(c, req.tenant.tariff); s.estMin += d.estMin; s.estMax += d.estMax; });
  res.json(s);
});

// Tariff: everyone can read it, only managers change it. Carrier entries hold fixed per-day rates and free days.
router.get('/tariff', (req, res) => res.json({ ...DEFAULT_TARIFF, ...(req.tenant.tariff || {}) }));
router.put('/tariff', requireManager, async (req, res) => {
  const b = req.body, rates = {}, carriers = {};
  const bad = (m) => res.status(400).json({ error: m });
  for (const k of TYPES) {
    const min = Number(b.rates?.[k]?.min), max = Number(b.rates?.[k]?.max);
    if (!(min >= 0) || !(max >= min)) return bad(`Check the rates for ${k}: the maximum must be at least the minimum.`);
    rates[k] = { min, max };
  }
  const tier2StartDay = Number(b.tier2StartDay), tier2Multiplier = Number(b.tier2Multiplier);
  if (!(tier2StartDay > 0) || !(tier2Multiplier >= 1)) return bad('Extended-stay start day and multiplier are not valid.');
  for (const [name, v] of Object.entries(b.carriers || {})) {
    const o = {}, rr = {};
    if (v.freeDays !== '' && v.freeDays != null) { const f = Number(v.freeDays); if (!(f >= 0)) return bad(`Free days for ${name} are not valid.`); o.freeDays = f; }
    for (const k of TYPES) {
      const x = v.rates?.[k]; if (x === '' || x == null) continue;
      const num = Number(typeof x === 'object' ? x.min : x); if (!(num >= 0)) return bad(`The ${k} rate for ${name} is not valid.`);
      rr[k] = { min: num, max: num };
    }
    if (Object.keys(rr).length) o.rates = rr;
    if (o.freeDays != null || o.rates) carriers[name.trim().toUpperCase()] = o;
  }
  const tariff = { tier2StartDay, tier2Multiplier, rates, carriers };
  await Tenant.updateOne({ _id: req.tenantId }, { $set: { tariff } });
  res.json(tariff);
});

// Agency analytics: where time is lost, which lines and staff drive it, and demurrage exposure.
router.get('/analytics', async (req, res) => {
  const list = await Consignment.find({ tenantId: req.tenantId });
  const stageSum = {}, stageN = {}, lines = {}, staff = {};
  let clearedDays = 0, cleared = 0, overDays = 0, overFiles = 0, expMin = 0, expMax = 0, flagged = 0;
  for (const c of list) {
    const latest = new Map();
    c.milestoneHistory.filter(h => h.action === 'ADVANCE').forEach(h => latest.set(h.milestone, h));
    let prev = c.arrivalDate;
    for (const m of MILESTONES.slice(1)) {
      const h = latest.get(m); if (!h) break;
      const days = Math.max(0, (h.updatedAt - prev) / 86400000);
      stageSum[m] = (stageSum[m] || 0) + days; stageN[m] = (stageN[m] || 0) + 1; prev = h.updatedAt;
    }
    c.milestoneHistory.filter(h => h.action === 'ADVANCE').forEach(h => { staff[h.updatedByName] = (staff[h.updatedByName] || 0) + 1; if (h.proofRisk === 'REVIEW' && !h.reviewedAt) flagged++; });
    const L = (lines[c.shippingLine] = lines[c.shippingLine] || { shippingLine: c.shippingLine, containers: 0, cleared: 0, days: 0, overDays: 0, estMin: 0, estMax: 0 });
    L.containers++;
    const dm = calcDemurrage(c, req.tenant.tariff); expMin += dm.estMin; expMax += dm.estMax; L.estMin += dm.estMin; L.estMax += dm.estMax;
    if (c.computeRisk() === 'CLEARED') { cleared++; clearedDays += c.daysElapsed; L.cleared++; L.days += c.daysElapsed; }
    if (c.daysRemaining < 0) { overDays += -c.daysRemaining; overFiles++; L.overDays += -c.daysRemaining; }
  }
  const stages = MILESTONES.slice(1).map(m => ({ key: m, label: MILESTONE_LABELS[m], avgDays: stageN[m] ? +(stageSum[m] / stageN[m]).toFixed(1) : null, samples: stageN[m] || 0 }));
  const measured = stages.filter(s => s.avgDays !== null);
  res.json({
    totals: { containers: list.length, cleared, avgClearanceDays: cleared ? +(clearedDays / cleared).toFixed(1) : null, filesWithFines: overFiles, demurrageDays: overDays, estMin: expMin, estMax: expMax, flaggedProofs: flagged },
    stages, bottleneck: measured.length ? measured.reduce((a, b) => (b.avgDays > a.avgDays ? b : a)) : null,
    shippingLines: Object.values(lines).map(l => ({ ...l, avgDays: l.cleared ? +(l.days / l.cleared).toFixed(1) : null })).sort((a, b) => b.containers - a.containers),
    staff: Object.entries(staff).map(([name, milestones]) => ({ name, milestones })).sort((a, b) => b.milestones - a.milestones)
  });
});

router.get('/:id', async (req, res) => {
  const c = await find(req);
  if (!c) return res.status(404).json({ error: 'Consignment not found' });
  res.json(out(c, req));
});

// PDF clearance report (agency version, includes document-check results)
router.get('/:id/report', async (req, res) => {
  const c = await find(req);
  if (!c) return res.status(404).json({ error: 'Consignment not found' });
  const doc = await buildReport(c, req.tenant, req.query.lang === 'en' ? 'en' : 'fr', 'agency');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="veridock-${c.containerNumber}.pdf"`);
  doc.pipe(res); doc.end();
});

router.post('/', async (req, res) => {
  try {
    const b = req.body;
    const c = await Consignment.create({
      tenantId: req.tenantId, billOfLading: b.billOfLading, containerNumber: b.containerNumber, camcisReference: b.camcisReference || undefined,
      containerType: TYPES.includes(b.containerType) ? b.containerType : '20DRY', importerLanguage: b.importerLanguage === 'en' ? 'en' : 'fr',
      importerName: b.importerName, importerPhone: normalizePhone(b.importerPhone), shippingLine: b.shippingLine,
      port: b.port, demurrageFreeDays: Number(b.demurrageFreeDays), arrivalDate: b.arrivalDate
    });
    await evaluateRisk(c).catch(console.error);
    res.status(201).json(c);
  } catch (e) {
    res.status(e.code === 11000 ? 409 : 400).json({ error: e.code === 11000 ? 'This bill of lading already exists in your agency.' : e.message });
  }
});

// Anti-falsification: next milestone only. The proof must be a real JPG/PNG/WEBP/PDF; reuse, editing,
// stale photos and clock tricks are detected and flagged for manager review.
router.post('/:id/advance', upload.single('proof'), async (req, res) => {
  try {
    const c = await find(req);
    if (!c) return res.status(404).json({ error: 'Consignment not found' });
    const idx = MILESTONES.indexOf(c.currentMilestone);
    if (idx === MILESTONES.length - 1) return res.status(400).json({ error: 'Already at the final milestone.' });
    const insp = await inspectProof(req.file, { arrivalDate: c.arrivalDate });
    const dup = await Consignment.findOne({ tenantId: req.tenantId, 'milestoneHistory.proofSha256': insp.sha256 }).select('containerNumber');
    if (dup) insp.checks.push({ code: 'REUSED_DOCUMENT', level: 'high', message: dup._id.equals(c._id) ? 'The same file was already used for another milestone of this container.' : `The same file was already used on container ${dup.containerNumber}.` });
    const risk = insp.checks.some(k => k.level !== 'info') ? 'REVIEW' : 'OK';
    req.file.mimetype = insp.mime;
    const proof = await saveProof(req.file, req.tenantId);
    const next = MILESTONES[idx + 1];
    c.currentMilestone = next;
    if (next === 'GATE_PASS_ISSUED') c.exitedAt = new Date();
    c.milestoneHistory.push({ milestone: next, action: 'ADVANCE', updatedBy: req.user._id, updatedByName: req.user.name,
      proofDocumentUrl: proof.url, proofSha256: proof.sha256, proofMime: proof.mime, proofChecks: insp.checks, proofRisk: risk, exifTakenAt: insp.takenAt || undefined, notes: req.body.notes });
    await c.save();
    // Non-blocking so a gateway outage never stalls port operations
    sendSms({ tenantId: c.tenantId, consignmentId: c._id, to: c.importerPhone, body: progressMessage(c, next) }).catch(console.error);
    if (risk === 'REVIEW') alertProofReview(c, MILESTONE_LABELS[next], insp.checks).catch(console.error);
    evaluateRisk(c).catch(console.error);
    res.json(c);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// A manager signs off a flagged proof after checking it, with an optional note.
router.post('/:id/history/:hid/review', requireManager, async (req, res) => {
  const c = await find(req);
  const h = c && c.milestoneHistory.id(req.params.hid);
  if (!h) return res.status(404).json({ error: 'Entry not found' });
  h.reviewedBy = req.user._id; h.reviewedByName = req.user.name; h.reviewedAt = new Date(); h.reviewNote = String(req.body.note || '').slice(0, 300);
  await c.save(); res.json(out(c, req));
});

// Corrections are audited, manager-only, and need a written reason.
router.post('/:id/revert', requireManager, async (req, res) => {
  const c = await find(req);
  if (!c) return res.status(404).json({ error: 'Consignment not found' });
  if (!req.body.reason || req.body.reason.length < 10) return res.status(400).json({ error: 'Give a reason of at least 10 characters.' });
  const idx = MILESTONES.indexOf(c.currentMilestone);
  if (idx === 0) return res.status(400).json({ error: 'Already at the first milestone.' });
  c.milestoneHistory.push({ milestone: c.currentMilestone, action: 'REVERT', updatedBy: req.user._id, updatedByName: req.user.name, notes: req.body.reason });
  c.currentMilestone = MILESTONES[idx - 1]; c.exitedAt = undefined;
  await c.save(); evaluateRisk(c).catch(console.error); res.json(c);
});

// Record or correct the CAMCIS declaration reference. Agents may set it once; only managers may change it.
router.patch('/:id/camcis', async (req, res) => {
  const c = await find(req);
  if (!c) return res.status(404).json({ error: 'Consignment not found' });
  const ref = String(req.body.camcisReference || '').trim();
  if (ref.length < 5) return res.status(400).json({ error: 'Enter the full CAMCIS reference.' });
  if (c.camcisReference && req.user.role !== 'MANAGER') return res.status(403).json({ error: 'Only a manager can change a recorded CAMCIS reference.' });
  c.camcisReference = ref; await c.save(); res.json(c);
});

router.get('/:id/sms', async (req, res) =>
  res.json(await SmsLog.find({ tenantId: req.tenantId, consignmentId: req.params.id }).sort({ createdAt: -1 }).limit(20)));
module.exports = router;
