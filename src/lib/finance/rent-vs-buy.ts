/**
 * Rent or buy, settled by arithmetic rather than opinion.
 *
 * The method is a wealth comparison, not a cost comparison, because a cost
 * comparison always flatters renting: rent is pure outflow while an EMI quietly
 * builds equity, and adding those two numbers up side by side compares
 * unalike things.
 *
 * So both households are given the same starting capital and the same monthly
 * outflow, every month:
 *
 *   The buyer spends the deposit and closing costs on day one, then pays
 *   EMI + maintenance each month. Their wealth is the home's resale value less
 *   whatever is still owed.
 *
 *   The renter keeps that same opening capital invested, pays rent each month,
 *   and invests the difference between the buyer's outflow and their own — so
 *   in the years when owning costs more per month, that surplus compounds in
 *   the renter's favour rather than vanishing. In the later years, when rent
 *   escalation overtakes a fixed EMI, the renter draws the shortfall back out.
 *   Their wealth is the portfolio.
 *
 * Neither household is allowed a cheaper month than the other, which is what
 * makes the crossing point mean something. Everything runs as a real monthly
 * amortisation loop rather than a closed-form approximation, so the equity
 * curve bends the way an actual loan does — barely moving in the early years.
 */

export interface RentVsBuyInputs {
  /** Purchase price of the home. */
  price: number;
  /** Market rent for a comparable home, per month. */
  rentMonthly: number;
  /** Owner's monthly maintenance. A tenant's rent is assumed to cover theirs. */
  maintenanceMonthly: number;

  downPct: number;
  /** Stamp duty, transfer duty and registration, as a share of price. */
  closingPct: number;
  ratePct: number
  tenureYears: number;

  /** Annual capital appreciation of the home. */
  appreciationPct: number;
  /** Annual rent escalation. */
  rentEscalationPct: number;
  /** What the renter's invested capital earns annually. */
  investmentReturnPct: number;
  /** Brokerage, paperwork and time-on-market, as a share of the sale price. */
  sellingCostPct: number;
  /** Annual growth in maintenance and property tax. */
  costInflationPct: number;

  /** How many years to project. */
  horizonYears: number;
}

export interface YearPoint {
  year: number;
  /** Resale value less outstanding loan, after selling costs. */
  buyWealth: number;
  /** The renter's portfolio. */
  rentWealth: number;
  /** Positive once owning is ahead. */
  advantage: number;
}

export interface RentVsBuyResult {
  emi: number;
  upfront: number;
  /** Owner's outflow in month one — EMI plus maintenance. */
  monthlyOwning: number;
  points: YearPoint[];
  /**
   * The first whole year at which owning is ahead and stays ahead.
   * `null` when renting wins for the entire horizon.
   */
  breakEvenYear: number | null;
  /** Fractional crossing point, for placing the marker on the chart. */
  breakEvenExact: number | null;
  /** Owning's lead at the end of the horizon. Negative means renting won. */
  advantageAtHorizon: number;
}

export const DEFAULT_ASSUMPTIONS = {
  downPct: 20,
  /** Telangana: 4% stamp duty + 1.5% transfer duty + 0.5% registration. */
  closingPct: 6,
  ratePct: 8.5,
  tenureYears: 20,
  rentEscalationPct: 7,
  investmentReturnPct: 10,
  sellingCostPct: 2,
  costInflationPct: 5,
  horizonYears: 20,
} as const;

export function emiFor(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 12 / 100;
  const n = Math.round(years * 12);
  if (n <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/** Annual rate to its monthly equivalent, compounded rather than divided. */
function monthlyRate(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

export function projectRentVsBuy(input: RentVsBuyInputs): RentVsBuyResult {
  const loan = Math.max(0, input.price * (1 - input.downPct / 100));
  const emi = emiFor(loan, input.ratePct, input.tenureYears);
  const upfront = input.price * (input.downPct / 100 + input.closingPct / 100);

  const apprM = monthlyRate(input.appreciationPct);
  const invM = monthlyRate(input.investmentReturnPct);
  const escM = monthlyRate(input.rentEscalationPct);
  const inflM = monthlyRate(input.costInflationPct);
  const loanM = input.ratePct / 12 / 100;
  const tenureMonths = Math.round(input.tenureYears * 12);

  let balance = loan;
  let homeValue = input.price;
  let rent = input.rentMonthly;
  let maintenance = input.maintenanceMonthly;
  // The renter starts holding exactly what the buyer just handed over.
  let portfolio = upfront;

  const points: YearPoint[] = [
    {
      year: 0,
      // Day one, owning is behind by the closing costs — duty and registration
      // buy no asset — and by what it would cost to sell again.
      buyWealth: homeValue * (1 - input.sellingCostPct / 100) - balance,
      rentWealth: portfolio,
      advantage:
        homeValue * (1 - input.sellingCostPct / 100) - balance - portfolio,
    },
  ];

  const months = Math.round(input.horizonYears * 12);
  for (let m = 1; m <= months; m++) {
    // The loan, one month on.
    const owingThisMonth = m <= tenureMonths && balance > 0;
    const interest = owingThisMonth ? balance * loanM : 0;
    const payment = owingThisMonth ? Math.min(emi, balance + interest) : 0;
    balance = Math.max(0, balance + interest - payment);

    const ownerOutflow = payment + maintenance;

    // Same month, same money: whatever the owner spends beyond the rent, the
    // renter invests; whatever they spend less, the renter withdraws.
    portfolio = portfolio * (1 + invM) + (ownerOutflow - rent);
    homeValue *= 1 + apprM;
    rent *= 1 + escM;
    maintenance *= 1 + inflM;

    if (m % 12 === 0) {
      const buyWealth = homeValue * (1 - input.sellingCostPct / 100) - balance;
      points.push({
        year: m / 12,
        buyWealth,
        rentWealth: portfolio,
        advantage: buyWealth - portfolio,
      });
    }
  }

  // The first year owning pulls ahead *and stays* ahead. A single crossing that
  // reverses two years later is not an answer anyone can act on.
  let breakEvenYear: number | null = null;
  for (const p of points) {
    if (p.year === 0) continue;
    if (p.advantage > 0 && points.filter((q) => q.year >= p.year).every((q) => q.advantage > 0)) {
      breakEvenYear = p.year;
      break;
    }
  }

  // Straight-line interpolation between the two bracketing years, so the
  // marker sits where the curves actually cross rather than on a tick.
  let breakEvenExact: number | null = null;
  if (breakEvenYear != null) {
    const after = points.find((p) => p.year === breakEvenYear)!;
    const before = points.find((p) => p.year === breakEvenYear - 1);
    breakEvenExact =
      before && before.advantage < 0
        ? before.year + before.advantage / (before.advantage - after.advantage)
        : after.year;
  }

  return {
    emi,
    upfront,
    monthlyOwning: emi + input.maintenanceMonthly,
    points,
    breakEvenYear,
    breakEvenExact,
    advantageAtHorizon: points[points.length - 1]?.advantage ?? 0,
  };
}

/**
 * The appreciation a corridor would need for owning to be ahead by a given year.
 *
 * "Years until owning wins" is the natural way to rank corridors until the
 * reader drags appreciation down — then *nothing* breaks even, every corridor
 * reads `20+`, and the ranking stops saying anything at all. The question has an
 * inverse that always discriminates: hold the horizon still and solve for the
 * growth rate instead. It is also the more useful question of the two, because
 * it is the one a buyer can actually sanity-check against what they believe
 * about the area.
 *
 * Owning's position improves monotonically with appreciation — every extra
 * point of growth lands on an asset the renter does not hold — so a bisection
 * is sound. Returns `null` when even 30% a year cannot get there, which means
 * the rent is so cheap relative to the price that no growth story rescues it.
 */
export function appreciationNeededBy(
  base: RentVsBuyInputs,
  byYear: number,
): number | null {
  const aheadAt = (appreciationPct: number) => {
    const r = projectRentVsBuy({ ...base, appreciationPct, horizonYears: byYear });
    const p = r.points[r.points.length - 1];
    return !!p && p.advantage > 0;
  };

  let lo = 0;
  let hi = 30;
  if (!aheadAt(hi)) return null;
  if (aheadAt(lo)) return 0;
  // 14 halvings of a 30-point range settles well inside the 0.1 we report.
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (aheadAt(mid)) hi = mid;
    else lo = mid;
  }
  return Math.round(hi * 10) / 10;
}
