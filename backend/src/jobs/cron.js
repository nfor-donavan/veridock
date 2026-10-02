const cron = require('node-cron');
const { Consignment } = require('../models');

// Risk changes with time, not only on updates: refresh stored levels hourly and surface newly critical files.
module.exports = function startJobs() {
  cron.schedule('0 * * * *', async () => {
    const open = await Consignment.find({ currentMilestone: { $ne: 'GATE_PASS_ISSUED' } });
    for (const c of open) {
      const level = c.computeRisk();
      if (level !== c.riskLevel) {
        c.riskLevel = level; await c.save();
        if (level === 'CRITICAL_RISK' || level === 'FINES_ACCUMULATING')
          console.warn(`[RISK] ${c.containerNumber} (${c.importerName}) is now ${level}, ${c.daysRemaining} day(s) remaining`);
      }
    }
  });
};
