const cron = require('node-cron');
const { Consignment } = require('../models');
const { evaluateRisk } = require('../services/alerts');

// Risk changes with time, not only on updates: re-check every open container every 30 minutes
async function run() {
  const open = await Consignment.find({ currentMilestone: { $ne: 'GATE_PASS_ISSUED' } });
  for (const c of open) await evaluateRisk(c).catch(e => console.error('Risk check failed:', e.message));
}
module.exports = function startJobs() {
  cron.schedule('*/30 * * * *', run);
  setTimeout(run, 20000);
};
