const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { MILESTONES, MILESTONE_LABELS, MILESTONE_LABELS_FR } = require('../models');
const { calcDemurrage, TYPE_LABELS } = require('./demurrage');

const L = {
  en: { title: 'Clearance report', sub: 'Port transit phase, Douala and Kribi', agency: 'Transit agency', generated: 'Generated', container: 'Container', bl: 'Bill of lading', camcis: 'CAMCIS reference', type: 'Type', line: 'Shipping line', importer: 'Importer', port: 'Port', arrival: 'Arrival', status: 'Status', step: 'Step',
    timeline: 'Clearance timeline', pending: 'Pending', by: 'by', sha: 'File fingerprint (SHA-256)', checks: 'Document checks', ok: 'Passed', review: 'Flagged for review', reviewed: 'Reviewed by',
    dem: 'Storage charges (demurrage)', free: 'Free days', elapsed: 'Days since arrival', chargeable: 'Chargeable days', none: 'No storage charges so far.', period: 'Period (day)', days: 'Days', rate: 'Rate / day', subtotal: 'Subtotal', total: 'Total',
    est: 'Estimate based on the agency tariff. The final amount is set by the shipping line.', exact: 'Calculated from the shipping line tariff on file.', det: 'Detention (holding the container outside the terminal) is not included.',
    scan: 'Scan to check the live status', fp: 'Report fingerprint', disc: 'This report lists documents uploaded by the transit agency. A matching fingerprint shows a file was not changed after upload; it does not by itself prove that a stamp is genuine.',
    s: { SAFE: 'On schedule', WARNING: 'Free period running down', CRITICAL_RISK: 'Critical', FINES_ACCUMULATING: 'Storage fines accruing', CLEARED: 'Cleared for exit' }, labels: MILESTONE_LABELS },
  fr: { title: 'Rapport de dédouanement', sub: 'Phase de transit portuaire, Douala et Kribi', agency: 'Agence de transit', generated: 'Généré le', container: 'Conteneur', bl: 'Connaissement (B/L)', camcis: 'Référence CAMCIS', type: 'Type', line: 'Compagnie maritime', importer: 'Importateur', port: 'Port', arrival: 'Arrivée', status: 'Statut', step: 'Étape',
    timeline: 'Étapes du dédouanement', pending: 'En attente', by: 'par', sha: 'Empreinte du fichier (SHA-256)', checks: 'Contrôles du document', ok: 'Conformes', review: 'À vérifier', reviewed: 'Vérifié par',
    dem: 'Frais de stockage (surestaries)', free: 'Jours gratuits', elapsed: 'Jours depuis l\u2019arrivée', chargeable: 'Jours facturables', none: 'Aucun frais de stockage à ce jour.', period: 'Période (jour)', days: 'Jours', rate: 'Tarif / jour', subtotal: 'Sous-total', total: 'Total',
    est: 'Estimation selon le tarif de l\u2019agence. Le montant final est fixé par la compagnie maritime.', exact: 'Calculé selon le tarif de la compagnie maritime enregistré.', det: 'Les frais de détention (conteneur gardé hors du terminal) ne sont pas inclus.',
    scan: 'Scannez pour voir le statut en direct', fp: 'Empreinte du rapport', disc: 'Ce rapport liste les documents déposés par l\u2019agence de transit. Une empreinte identique montre qu\u2019un fichier n\u2019a pas été modifié après le dépôt ; elle ne prouve pas à elle seule l\u2019authenticité d\u2019un cachet.',
    s: { SAFE: 'Dans les délais', WARNING: 'Délai gratuit bientôt écoulé', CRITICAL_RISK: 'Critique', FINES_ACCUMULATING: 'Surestaries en cours', CLEARED: 'Sorti du port' }, labels: MILESTONE_LABELS_FR }
};
const n = (x) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const money = (a, b) => (a === b ? n(a) : `${n(a)} - ${n(b)}`);
const when = (d, lang) => new Date(d).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { timeZone: 'Africa/Douala', dateStyle: 'medium', timeStyle: 'short' }).replace(/[\u202f\u00a0]/g, ' ');
const day = (d, lang) => new Date(d).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { timeZone: 'Africa/Douala', dateStyle: 'medium' }).replace(/[\u202f\u00a0]/g, ' ');

// audience 'agency' includes document-check results; 'public' (importer link) leaves them out
async function buildReport(c, tenant, lang = 'fr', audience = 'agency') {
  const T = L[lang] || L.fr, dm = calcDemurrage(c, tenant.tariff), risk = c.computeRisk();
  const link = `${process.env.TRACKER_BASE_URL || 'https://tracker.veridock.cm'}/bl/${c.publicToken}`;
  const adv = new Map(c.milestoneHistory.filter(h => h.action === 'ADVANCE').map(h => [h.milestone, h]));
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ bl: c.billOfLading, ct: c.containerNumber, steps: [...adv.values()].map(h => [h.milestone, h.updatedAt, h.proofSha256]), dm: [dm.estMin, dm.estMax] })).digest('hex');
  const qr = await QRCode.toBuffer(link.startsWith('http') ? link : `https://${link}`, { margin: 1, width: 220 });

  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `${T.title} ${c.containerNumber}`, Author: 'Veridock' } });
  const W = doc.page.width - 96;
  const ensure = (h) => { if (doc.y + h > doc.page.height - 70) doc.addPage(); };

  // header band with the Veridock hexagon mark
  doc.rect(0, 0, doc.page.width, 92).fill('#0A1B2E');
  doc.save().translate(48, 20).scale(0.28); doc.path('M90 0 172 45v90L90 180 8 135V45z').fill('#12A5B0'); doc.path('M90 14 160 52v76L90 166 20 128V52z').lineWidth(4).stroke('#C9A24B'); doc.restore();
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('Veridock', 108, 24);
  doc.font('Helvetica').fontSize(11).fillColor('#9FB3C8').text(T.title, 108, 50).text(T.sub, 108, 65);
  doc.fillColor('#0A1B2E'); doc.y = 112;

  const kv = (pairs) => {
    const colW = W / 2; let y = doc.y;
    pairs.forEach(([k, v], i) => {
      const x = 48 + (i % 2) * colW; if (i % 2 === 0 && i > 0) y += 34;
      doc.font('Helvetica').fontSize(8).fillColor('#5B7088').text(String(k).toUpperCase(), x, y, { width: colW - 10 });
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0A1B2E').text(String(v || '-'), x, y + 11, { width: colW - 10 });
    });
    doc.y = y + 40; doc.x = 48;
  };
  const h2 = (t) => { ensure(60); doc.moveDown(0.6); doc.font('Helvetica-Bold').fontSize(13).fillColor('#0E7C86').text(t, 48); doc.moveTo(48, doc.y + 2).lineTo(48 + W, doc.y + 2).strokeColor('#D5DEE5').stroke(); doc.moveDown(0.6); };

  kv([[T.container, c.containerNumber], [T.bl, c.billOfLading], [T.camcis, c.camcisReference], [T.type, TYPE_LABELS[c.containerType]], [T.line, c.shippingLine], [T.importer, c.importerName],
    [T.agency, tenant.agencyName], [T.port, c.port === 'KRIBI' ? 'Kribi' : 'Douala'], [T.arrival, day(c.arrivalDate, lang)], [T.status, `${T.s[risk]} - ${T.step} ${c.step}/6`]]);

  h2(T.timeline);
  MILESTONES.forEach((m, i) => {
    ensure(54); const h = adv.get(m), done = i + 1 <= c.step && (h || i === 0);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(done ? '#0A1B2E' : '#8A9BAD').text(`${i + 1}. ${T.labels[m]}`, 48, doc.y);
    const sub = h ? `${when(h.updatedAt, lang)}  ${T.by} ${h.updatedByName || '-'}` : (i === 0 ? day(c.arrivalDate, lang) : T.pending);
    doc.font('Helvetica').fontSize(9).fillColor('#5B7088').text(sub, 62, doc.y);
    if (h && h.proofSha256) {
      doc.font('Courier').fontSize(7.5).fillColor('#5B7088').text(`${T.sha}: ${h.proofSha256}`, 62, doc.y, { width: W - 14 });
      if (audience === 'agency') {
        const flagged = h.proofRisk === 'REVIEW';
        doc.font('Helvetica').fontSize(8.5).fillColor(flagged && !h.reviewedAt ? '#B3261E' : '#2E7D55')
          .text(`${T.checks}: ${flagged ? (h.reviewedAt ? `${T.reviewed} ${h.reviewedByName || '-'}` : T.review) : T.ok}`, 62, doc.y);
      }
    }
    doc.moveDown(0.5);
  });

  h2(T.dem);
  const st = [[T.free, c.demurrageFreeDays], [T.elapsed, c.daysElapsed], [T.chargeable, dm.chargeableDays], [T.type, TYPE_LABELS[c.containerType]]];
  kv(st);
  if (!dm.segments.length) { doc.font('Helvetica').fontSize(10).fillColor('#2E7D55').text(T.none, 48); }
  else {
    const cols = [48, 190, 250, 370, 470]; let y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#5B7088');
    [T.period, T.days, T.rate, T.subtotal].forEach((t, i) => doc.text(t.toUpperCase(), cols[i], y, { width: cols[i + 1] - cols[i] - 6 }));
    y += 16; doc.font('Helvetica').fontSize(10).fillColor('#0A1B2E');
    dm.segments.forEach(s => {
      doc.text(`${s.fromDay} - ${s.toDay}`, cols[0], y); doc.text(String(s.days), cols[1], y);
      doc.text(`${money(s.rateMin, s.rateMax)} XAF`, cols[2], y, { width: 115 }); doc.text(`${money(s.subMin, s.subMax)} XAF`, cols[3], y, { width: 120 }); y += 18;
    });
    doc.moveTo(48, y).lineTo(48 + W, y).strokeColor('#D5DEE5').stroke();
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#8E1F2F').text(`${T.total}: ${money(dm.estMin, dm.estMax)} XAF`, 48, y + 8);
    doc.y = y + 30;
  }
  doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#5B7088').text(dm.exact && dm.segments.length ? T.exact : T.est, 48, doc.y, { width: W }).text(T.det, 48, doc.y, { width: W });

  ensure(130); doc.moveDown(1);
  const top = doc.y;
  doc.image(qr, 48, top, { width: 78 });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0A1B2E').text(T.scan, 138, top + 4, { width: W - 100 });
  doc.font('Courier').fontSize(7.5).fillColor('#5B7088').text(`${T.fp}: ${fingerprint}`, 138, top + 22, { width: W - 100 });
  doc.font('Helvetica').fontSize(7.5).text(`${T.generated}: ${when(new Date(), lang)}`, 138, top + 46, { width: W - 100 });
  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#5B7088').text(T.disc, 138, top + 58, { width: W - 100 });
  return doc;
}
module.exports = { buildReport };
