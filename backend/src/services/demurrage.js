// Port-phase demurrage only: storage of full containers inside the terminal, counted until the gate pass.
// Detention (container held outside the terminal during unpacking) starts after gate-out and is not tracked here.
// Figures are ESTIMATES from the tenant's tariff (rates differ by carrier and are quoted as a range).
const DEFAULT_TARIFF = {
  tier2StartDay: 21,        // calendar day (from arrival) after which the deep extended-stay rate applies
  tier2Multiplier: 2,       // rates double in the extended-stay tier
  rates: {                  // XAF per container, per day, after the free time
    '20DRY': { min: 6000, max: 7500 },
    '40DRY': { min: 12000, max: 15000 },
    '40HC':  { min: 12000, max: 15000 }
  }
};
const TYPE_LABELS = { '20DRY': "20' Dry", '40DRY': "40' Dry", '40HC': "40' High Cube" };

function calcDemurrage(c, tariff) {
  const t = { ...DEFAULT_TARIFF, ...(tariff || {}), rates: { ...DEFAULT_TARIFF.rates, ...((tariff || {}).rates || {}) } };
  const rate = t.rates[c.containerType] || t.rates['20DRY'];
  const elapsed = c.daysElapsed, free = c.demurrageFreeDays;
  const open = c.currentMilestone !== 'GATE_PASS_ISSUED';
  const chargeableDays = Math.max(0, elapsed - free);
  const tier2From = Math.max(free, t.tier2StartDay);       // days beyond this are extended-stay days
  const tier2Days = Math.max(0, elapsed - tier2From);
  const tier1Days = chargeableDays - tier2Days;
  const units = tier1Days + tier2Days * t.tier2Multiplier;
  const nextDay = elapsed + 1;
  const mult = nextDay > tier2From ? t.tier2Multiplier : 1;
  const accruing = open && nextDay > free;
  return {
    containerType: c.containerType, chargeableDays, tier1Days, tier2Days,
    estMin: units * rate.min, estMax: units * rate.max,
    currentDailyMin: accruing ? rate.min * mult : 0, currentDailyMax: accruing ? rate.max * mult : 0,
    extendedTierActive: open && elapsed >= tier2From && chargeableDays > 0
  };
}
module.exports = { DEFAULT_TARIFF, TYPE_LABELS, calcDemurrage };
