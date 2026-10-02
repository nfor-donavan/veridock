require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Tenant, User, GlobalSuperAdmin, Consignment } = require('./models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await GlobalSuperAdmin.updateOne({ email: process.env.SUPER_ADMIN_EMAIL }, { passwordHash: await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, 10) }, { upsert: true });
  let t = await Tenant.findOne({ licenceNumber: 'DEMO-001' });
  if (!t) {
    t = await Tenant.create({ agencyName: 'Demo Transit Douala', licenceNumber: 'DEMO-001', port: 'DOUALA' });
    await User.create({ tenantId: t._id, name: 'Demo Manager', email: 'manager@demo.cm', role: 'MANAGER', passwordHash: await bcrypt.hash('Demo#2026', 10) });
    const day = 86400000;
    const rows = [['MSKU9876543', 'Ets Nkomo & Fils', 'Maersk', 21, 4], ['MSCU1234567', 'Kamga Import SARL', 'MSC', 10, 8], ['CMAU7654321', 'Biyick Electronics', 'CMA CGM', 14, 16]];
    for (const [i, r] of rows.entries())
      await Consignment.create({ tenantId: t._id, billOfLading: `BL-DEMO-${100 + i}`, containerNumber: r[0], containerType: i === 2 ? '40HC' : '20DRY', importerName: r[1], importerPhone: '+237699000000', shippingLine: r[2], demurrageFreeDays: r[3], arrivalDate: new Date(Date.now() - r[4] * day), currentMilestone: 'CUSTOMS_DECLARATION' });
  }
  console.log('Seeded. Desk login: manager@demo.cm / Demo#2026');
  process.exit(0);
})();
