const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

// Stores a proof file and returns { url, sha256, mime }. Cloudinary when configured, else local disk.
async function saveProof(file, tenantId) {
  if (!file) throw Object.assign(new Error('Proof document is required to move this milestone.'), { status: 400 });
  if (!ALLOWED.includes(file.mimetype)) throw Object.assign(new Error('Proof must be a JPG, PNG, WEBP or PDF file.'), { status: 400 });
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  if (process.env.CLOUDINARY_URL) {
    const cloudinary = require('cloudinary').v2;
    const url = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ folder: `veridock/${tenantId}`, resource_type: 'auto' },
        (err, r) => (err ? reject(err) : resolve(r.secure_url))).end(file.buffer);
    });
    return { url, sha256, mime: file.mimetype };
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = file.mimetype === 'application/pdf' ? 'pdf' : file.mimetype.split('/')[1];
  const name = `${Date.now()}-${sha256.slice(0, 12)}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), file.buffer);
  return { url: `/uploads/${name}`, sha256, mime: file.mimetype };
}
module.exports = { saveProof, UPLOAD_DIR };
