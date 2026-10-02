const mongoose = require('mongoose');
const crypto = require('crypto');
const { Schema } = mongoose;
const { DEFAULT_TARIFF } = require('../services/demurrage');

const MILESTONES = ['SGS_MANIFEST_ENTRY','CUSTOMS_DECLARATION','LIQUIDATION_SETTLED','BANK_DUTY_PAYMENT','PORT_PHYSICAL_INSPECTION','GATE_PASS_ISSUED'];
const MILESTONE_LABELS = {
  SGS_MANIFEST_ENTRY: 'Arrival & manifest registered',
  CUSTOMS_DECLARATION: 'Declaration lodged in CAMCIS',
  LIQUIDATION_SETTLED: 'Duties assessed (liquidation)',
  BANK_DUTY_PAYMENT: 'Duties paid at bank',
  PORT_PHYSICAL_INSPECTION: 'Scan / physical inspection',
  GATE_PASS_ISSUED: 'Gate pass issued (Bon à enlever)'
};

const Tenant = mongoose.model('Tenant', new Schema({
  agencyName: { type: String, required: true },
  licenceNumber: { type: String, required: true, unique: true },
  port: { type: String, enum: ['DOUALA', 'KRIBI'], default: 'DOUALA' },
  isPremium: { type: Boolean, default: true },
  tariff: { type: Schema.Types.Mixed, default: () => JSON.parse(JSON.stringify(DEFAULT_TARIFF)) },
  createdAt: { type: Date, default: Date.now }
}));

const GlobalSuperAdmin = mongoose.model('GlobalSuperAdmin', new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true }));

const User = mongoose.model('User', new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['AGENT', 'MANAGER'], default: 'AGENT' },
  active: { type: Boolean, default: true }
}, { timestamps: true }));

const SmsLog = mongoose.model('SmsLog', new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  consignmentId: { type: Schema.Types.ObjectId, ref: 'Consignment' },
  to: String, body: String,
  status: { type: String, enum: ['SENT', 'FAILED', 'MOCK'], default: 'SENT' },
  attempts: { type: Number, default: 0 }, error: String
}, { timestamps: true }));

const HistorySchema = new Schema({
  milestone: { type: String, enum: MILESTONES, required: true },
  action: { type: String, enum: ['ADVANCE', 'REVERT'], default: 'ADVANCE' },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedByName: String,
  proofDocumentUrl: String,
  proofSha256: String,
  proofMime: String,
  notes: String
});

const ConsignmentSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  billOfLading: { type: String, required: true, trim: true, uppercase: true },
  containerNumber: { type: String, required: true, trim: true, uppercase: true },
  containerType: { type: String, enum: ['20DRY', '40DRY', '40HC'], default: '20DRY' },
  camcisReference: { type: String, trim: true, uppercase: true }, // CAMCIS declaration number, lets importers cross-check with Customs
  importerName: { type: String, required: true, trim: true },
  importerPhone: { type: String, required: true },
  shippingLine: { type: String, required: true },
  port: { type: String, enum: ['DOUALA', 'KRIBI'], default: 'DOUALA' },
  demurrageFreeDays: { type: Number, required: true, min: 0 },
  arrivalDate: { type: Date, required: true },
  publicToken: { type: String, unique: true, default: () => crypto.randomBytes(9).toString('base64url') },
  currentMilestone: { type: String, enum: MILESTONES, default: MILESTONES[0] },
  exitedAt: Date,
  riskLevel: { type: String, enum: ['SAFE', 'WARNING', 'CRITICAL_RISK', 'FINES_ACCUMULATING', 'CLEARED'], default: 'SAFE' },
  milestoneHistory: [HistorySchema]
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// B/L is unique per agency (rival agencies may legitimately handle the same B/L on split shipments)
ConsignmentSchema.index({ tenantId: 1, billOfLading: 1 }, { unique: true });

const DAY = 86400000;
ConsignmentSchema.virtual('daysElapsed').get(function () {
  const end = this.exitedAt || new Date();
  return Math.floor((end - this.arrivalDate) / DAY);
});
// Days Remaining = FreeDays - (Today - Arrival); the clock stops at gate pass
ConsignmentSchema.virtual('daysRemaining').get(function () { return this.demurrageFreeDays - this.daysElapsed; });
ConsignmentSchema.virtual('step').get(function () { return MILESTONES.indexOf(this.currentMilestone) + 1; });

function computeRisk(c) {
  if (c.currentMilestone === 'GATE_PASS_ISSUED') return 'CLEARED';
  const d = c.daysRemaining;
  if (d < 0) return 'FINES_ACCUMULATING';
  if (d < 3) return 'CRITICAL_RISK';
  if (d <= 5) return 'WARNING';
  return 'SAFE';
}
ConsignmentSchema.methods.computeRisk = function () { return computeRisk(this); };
ConsignmentSchema.pre('save', function (next) { this.riskLevel = computeRisk(this); next(); });

const Consignment = mongoose.model('Consignment', ConsignmentSchema);
module.exports = { Tenant, GlobalSuperAdmin, User, SmsLog, Consignment, MILESTONES, MILESTONE_LABELS };
