const { Alert, User } = require('../models');
const { sendSms } = require('./sms');

async function sendEmail(to, subject, text) {
  if (!process.env.SMTP_HOST) { console.log(`[EMAIL MOCK] ${to}: ${subject}`); return; }
  const nodemailer = require('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);
  await nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
    .sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
}

// In-app alert plus email (and SMS when the manager saved a phone number)
async function raise(c, kind, message, messageFr) {
  await Alert.create({ tenantId: c.tenantId, consignmentId: c._id, kind, message, messageFr });
  const managers = await User.find({ tenantId: c.tenantId, role: 'MANAGER', active: true });
  for (const m of managers) {
    sendEmail(m.email, `Veridock alert / Alerte: ${c.containerNumber}`, `${message}\n\n${messageFr}`).catch(e => console.error('Email failed:', e.message));
    if (m.phone) sendSms({ tenantId: c.tenantId, consignmentId: c._id, to: m.phone, body: `Veridock: ${messageFr}` }).catch(console.error);
  }
}

// Alert once each time a container enters CRITICAL_RISK or FINES_ACCUMULATING
async function evaluateRisk(c) {
  const level = c.computeRisk();
  if (level === c.lastAlertedLevel) return;
  const prev = c.lastAlertedLevel;
  c.lastAlertedLevel = level; c.riskLevel = level;
  await c.save();
  if (prev === level) return;
  const who = `${c.containerNumber} (${c.importerName})`, d = c.daysRemaining;
  if (level === 'CRITICAL_RISK')
    await raise(c, level, `${who} is critical: ${d} free day(s) left before storage fines start.`, `${who} est critique : il reste ${d} jour(s) gratuit(s) avant les surestaries.`);
  if (level === 'FINES_ACCUMULATING')
    await raise(c, level, `${who} is past its free period by ${Math.abs(d)} day(s). Storage fines are accruing.`, `${who} a dépassé le délai gratuit de ${Math.abs(d)} jour(s). Les surestaries courent.`);
}

async function alertProofReview(c, milestoneLabel, checks) {
  const why = checks.filter(k => k.level !== 'info').map(k => k.message).join(' ');
  await raise(c, 'PROOF_REVIEW', `A proof for ${c.containerNumber} (${milestoneLabel}) needs review. ${why}`, `Un justificatif pour ${c.containerNumber} (${milestoneLabel}) est à vérifier.`);
}
module.exports = { evaluateRisk, alertProofReview, sendEmail };
