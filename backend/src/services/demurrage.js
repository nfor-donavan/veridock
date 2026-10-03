// Port-phase demurrage only: storage of full containers inside the terminal, counted until the gate pass.
// Detention (container held outside the terminal during unpacking) starts after gate-out and is not tracked here.
// Rates resolve in this order: the shipping line's own tariff, then the agency default range.
// A carrier rate is a single fixed figure, so the result is exact; the agency default is a min-max estimate.
const DEFAULT_TARIFF = {
  tier2StartDay: 21,        // calendar day (from arrival) after which the deep extended-stay rate applies
  tier2Multiplier: 2,       // rates double in the extended-stay tier
  rates: {                  // XAF per container, per day, after the free time
    '20DRY': { min: 6000, max: 7500 },
    '40DRY': { min: 12000, max: 15000 },
    '40HC':  { min: 12000, max: 15000 }
  },
  carriers: {}              // e.g. { MAERSK: { freeDays: 11, rates: { '20DRY': { min: 7000, max: 7000 } } } }
};
const TYPE_LABELS = { '20DRY': "20' Dry", '40DRY': "40' Dry", '40HC': "40' High Cube" };

function calcDemurrage(c, tariff) {
  const t = { ...DEFAULT_TARIFF, ...(tariff || {}), rates: { ...DEFAULT_TARIFF.rates, ...((tariff || {}).rates || {}) } };
  const ov = (t.carriers || {})[String(c.shippingLine || '').trim().toUpperCase()] || {};
  const carrierRate = ov.rates && ov.rates[c.containerType];
  const rate = carrierRate || t.rates[c.containerType] || t.rates['20DRY'];
  const tier2Start = ov.tier2StartDay || t.tier2StartDay, mult0 = ov.tier2Multiplier || t.tier2Multiplier;
  const elapsed = c.daysElapsed, free = c.demurrageFreeDays;
  const open = c.currentMilestone !== 'GATE_PASS_ISSUED';
  const chargeableDays = Math.max(0, elapsed - free);
  const tier2From = Math.max(free, tier2Start);              // days beyond this are extended-stay days
  const tier2Days = Math.max(0, elapsed - tier2From);
  const tier1Days = chargeableDays - tier2Days;
  const units = tier1Days + tier2Days * mult0;
  const nextDay = elapsed + 1;
  const mult = nextDay > tier2From ? mult0 : 1;
  const accruing = open && nextDay > free;
  const segments = [];
  if (tier1Days > 0) segments.push({ fromDay: free + 1, toDay: free + tier1Days, days: tier1Days, rateMin: rate.min, rateMax: rate.max, subMin: tier1Days * rate.min, subMax: tier1Days * rate.max });
  if (tier2Days > 0) segments.push({ fromDay: tier2From + 1, toDay: elapsed, days: tier2Days, rateMin: rate.min * mult0, rateMax: rate.max * mult0, subMin: tier2Days * rate.min * mult0, subMax: tier2Days * rate.max * mult0 });
  return {
    containerType: c.containerType, chargeableDays, tier1Days, tier2Days, segments,
    estMin: units * rate.min, estMax: units * rate.max,
    exact: rate.min === rate.max, source: carrierRate ? 'CARRIER' : 'AGENCY',
    currentDailyMin: accruing ? rate.min * mult : 0, currentDailyMax: accruing ? rate.max * mult : 0,
    extendedTierActive: open && elapsed >= tier2From && chargeableDays > 0
  };
}
module.exports = { DEFAULT_TARIFF, TYPE_LABELS, calcDemurrage };
