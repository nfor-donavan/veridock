const router = require('express').Router();
const { Consignment, Tenant, MILESTONES, MILESTONE_LABELS, MILESTONE_LABELS_FR } = require('../models');
const { calcDemurrage } = require('../services/demurrage');
const { buildReport } = require('../services/report');

// Public tracker: unguessable token, minimal data, no phone number, no tenant internals.
router.get('/track/:token', async (req, res) => {
  const c = await Consignment.findOne({ publicToken: req.params.token });
  if (!c) return res.status(404).json({ error: 'Tracking link not found' });
  const tenant = await Tenant.findById(c.tenantId);
  const done = new Map(c.milestoneHistory.filter(h => h.action === 'ADVANCE').map(h => [h.milestone, h]));
  res.json({
    demurrage: calcDemurrage(c, tenant.tariff), containerType: c.containerType, preferredLanguage: c.importerLanguage,
    agency: tenant.agencyName, port: c.port, containerNumber: c.containerNumber, camcisReference: c.camcisReference || null, billOfLading: c.billOfLading,
    importerName: c.importerName, shippingLine: c.shippingLine, arrivalDate: c.arrivalDate,
    step: c.step, total: MILESTONES.length, risk: c.computeRisk(), daysRemaining: c.daysRemaining, freeDays: c.demurrageFreeDays,
    steps: MILESTONES.map((m, i) => {
      const h = done.get(m);
      return { key: m, label: MILESTONE_LABELS[m], labelFr: MILESTONE_LABELS_FR[m], state: i + 1 < c.step ? 'done' : i + 1 === c.step ? 'current' : 'pending',
        at: h ? h.updatedAt : (i === 0 ? c.arrivalDate : null), proofUrl: h ? h.proofDocumentUrl : null, proofMime: h ? h.proofMime : null, sha256: h ? h.proofSha256 : null };
    })
  });
});

// Printable clearance report for the importer (no internal document-check details)
router.get('/track/:token/report', async (req, res) => {
  const c = await Consignment.findOne({ publicToken: req.params.token });
  if (!c) return res.status(404).json({ error: 'Tracking link not found' });
  const tenant = await Tenant.findById(c.tenantId);
  const doc = await buildReport(c, tenant, req.query.lang === 'en' ? 'en' : 'fr', 'public');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="veridock-${c.containerNumber}.pdf"`);
  doc.pipe(res); doc.end();
});
module.exports = router;
