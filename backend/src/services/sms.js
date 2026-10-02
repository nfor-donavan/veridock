const axios = require('axios');
const { SmsLog } = require('../models');

// Normalise Cameroon numbers to +237XXXXXXXXX
function normalizePhone(p) {
  const d = String(p).replace(/[^\d]/g, '');
  if (d.startsWith('237') && d.length === 12) return '+' + d;
  if (d.length === 9) return '+237' + d;
  return '+' + d;
}

// Non-blocking send with 3 retries (exponential backoff). Every message is logged in SmsLog.
async function sendSms({ tenantId, consignmentId, to, body }) {
  const log = await SmsLog.create({ tenantId, consignmentId, to, body });
  if (!process.env.SMS_API_URL) {
    console.log(`[SMS MOCK] ${to}: ${body}`);
    log.status = 'MOCK'; await log.save(); return;
  }
  for (let i = 1; i <= 3; i++) {
    try {
      log.attempts = i;
      // Generic gateway payload. Adapt to Campay / Orange / MTN specifics in this one place.
      await axios.post(process.env.SMS_API_URL, { to, message: body, sender: process.env.SMS_SENDER || 'VERIDOCK' },
        { headers: { Authorization: `Bearer ${process.env.SMS_API_KEY}` }, timeout: 8000 });
      log.status = 'SENT'; log.error = undefined; await log.save(); return;
    } catch (e) {
      log.status = 'FAILED'; log.error = e.message; await log.save();
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

function progressMessage(c, label) {
  const link = `${process.env.TRACKER_BASE_URL || 'tracker.veridock.cm'}/bl/${c.publicToken}`;
  return `Veridock: ${label} for container ${c.containerNumber}. Progress: Step ${c.step}/6. Document receipt attached. Live status: ${link}`;
}
module.exports = { sendSms, normalizePhone, progressMessage };
