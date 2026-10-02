const router = require('express').Router();
const { calcDemurrage } = require('../services/demurrage');
const { Consignment, Tenant, MILESTONES, MILESTONE_LABELS } = require('../models');

// Public tracker: unguessable token, minimal data, no phone number, no tenant internals.
router.get('/track/:token', async (req, res) => {
  const c = await Consignment.findOne({ publicToken: req.params.token });
  if (!c) return res.status(404).json({ error: 'Tracking link not found' });
  const tenant = await Tenant.findById(c.tenantId);
  const done = new Map(c.milestoneHistory.filter(h => h.action === 'ADVANCE').map(h => [h.milestone, h]));
  const dm = calcDemurrage(c, tenant.tariff);
  res.json({
    demurrage: dm, containerType: c.containerType,
    agency: tenant.agencyName, port: c.port, containerNumber: c.containerNumber, camcisReference: c.camcisReference || null, billOfLading: c.billOfLading,
    importerName: c.importerName, shippingLine: c.shippingLine, arrivalDate: c.arrivalDate,
    step: c.step, total: MILESTONES.length, risk: c.computeRisk(), daysRemaining: c.daysRemaining, freeDays: c.demurrageFreeDays,
    steps: MILESTONES.map((m, i) => {
      const h = done.get(m);
      return { key: m, label: MILESTONE_LABELS[m], state: i + 1 < c.step ? 'done' : i + 1 === c.step ? 'current' : 'pending',
        at: h ? h.updatedAt : (i === 0 ? c.arrivalDate : null), proofUrl: h ? h.proofDocumentUrl : null, proofMime: h ? h.proofMime : null, sha256: h ? h.proofSha256 : null };
    })
  });
});
module.exports = router;
