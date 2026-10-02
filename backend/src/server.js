require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { UPLOAD_DIR } = require('./services/storage');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: [process.env.DESK_ORIGIN, process.env.TRACKER_ORIGIN].filter(Boolean) }));
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 40 }), require('./routes/auth'));
app.use('/api/consignments', require('./routes/consignments'));
app.use('/api/public', rateLimit({ windowMs: 60 * 1000, max: 120 }), require('./routes/public'));
app.get('/api/health', (_, res) => res.json({ ok: true, service: 'veridock' }));
app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

mongoose.connect(process.env.MONGODB_URI).then(() => {
  require('./jobs/cron')();
  app.listen(process.env.PORT || 5000, () => console.log('Veridock API running'));
}).catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
