// Audit-grade checks on every proof upload. Structural failures block the upload; suspicious signals are
// stored on the milestone and flag it "REVIEW" for a manager. None of this proves a stamp is genuine,
// it makes reuse, editing, stale photos and clock tricks visible.
const crypto = require('crypto');

const bad = (m) => Object.assign(new Error(m), { status: 400 });
const EDITORS = /photoshop|lightroom|gimp|canva|snapseed|picsart|pixlr|affinity|illustrator|facetune|paint/i;

// Identify the real file type from its first bytes, ignoring the client-declared type
function sniff(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (b.length > 5 && b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

async function inspectProof(file, { arrivalDate, now = new Date() }) {
  if (!file) throw bad('Proof document is required to move this milestone.');
  const mime = sniff(file.buffer);
  if (!mime) throw bad('The file content is not a valid JPG, PNG, WEBP or PDF.');
  if (file.buffer.length < 5 * 1024) throw bad('The file is too small to be a real document photo or scan.');
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const checks = []; let takenAt = null;

  if (mime === 'image/jpeg') {
    let x = null;
    try { x = await require('exifr').parse(file.buffer, { pick: ['DateTimeOriginal', 'CreateDate', 'Make', 'Model', 'Software'] }); } catch { /* unreadable EXIF */ }
    if (!x || (!x.DateTimeOriginal && !x.CreateDate && !x.Make && !x.Model))
      checks.push({ code: 'NO_CAMERA_DATA', level: 'warn', message: 'The photo has no camera data. It may be a screenshot, a forwarded copy or an edited image.' });
    else {
      takenAt = x.DateTimeOriginal || x.CreateDate || null;
      if (x.Software && EDITORS.test(String(x.Software))) checks.push({ code: 'EDITING_SOFTWARE', level: 'warn', message: `The image was saved by editing software (${String(x.Software).slice(0, 40)}).` });
      if (takenAt instanceof Date && !isNaN(takenAt)) {
        if (takenAt > new Date(now.getTime() + 3600000)) checks.push({ code: 'FUTURE_DATE', level: 'high', message: 'The photo date is in the future. The phone clock may have been changed.' });
        else if (takenAt < new Date(arrivalDate.getTime() - 86400000)) checks.push({ code: 'PHOTO_BEFORE_ARRIVAL', level: 'high', message: 'The photo was taken before this container arrived.' });
        else if (now - takenAt > 72 * 3600000) checks.push({ code: 'STALE_PHOTO', level: 'warn', message: 'The photo was taken more than 3 days before it was uploaded.' });
      } else takenAt = null;
    }
  } else if (mime !== 'application/pdf') {
    checks.push({ code: 'NO_CAMERA_DATA', level: 'warn', message: 'PNG and WEBP files carry no camera data. A JPG photo or a PDF scan is preferred.' });
  }
  return { mime, sha256, checks, takenAt };
}
module.exports = { inspectProof };
