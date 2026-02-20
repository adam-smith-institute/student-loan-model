import { createApp, computed, onMounted, reactive, ref, watch } from "https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js";
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6/+esm";

const START_YEAR = 2013;
const DEFAULT_END_YEAR = 2060;
const PROJECTION_START_YEAR = 2026;
const PLAN2_COHORT_MIN_YEAR = 2012;
const PLAN2_COHORT_MAX_YEAR = 2023;
const MARKET_DISCOUNT_RATE = 0.08;
const POST_SERIES_RPI = 0.021;
const MONTHS_IN_YEAR = 12;
const DEFAULT_BORROWER_INPUTS = {
  graduationYear: 2018,
  startingSalary: 25000,
  studyYears: 3,
  balanceMode: "build-up",
  tuitionFee: 9000,
  maintenanceLoan: 3900,
  startingBalance2025: 54421,
};
const DEFAULT_POLICY_INPUTS = {
  lowRateSpreadOverRpi: 0,
  highRateSpreadOverRpi: 0.03,
  lowerThresholdForecastAdj: 0,
  upperThresholdForecastAdj: 0,
  repaymentRate: 0.09,
  writeoffYears: 30,
};
const BORROWER_PRESETS = {
  high: {
    graduationYear: 2018,
    startingSalary: 50000,
  },
  mid: {
    graduationYear: 2018,
    startingSalary: 25000,
  },
  low: {
    graduationYear: 2018,
    startingSalary: 16000,
  },
};

const BORROWER_FIELD_NAMES = Object.keys(DEFAULT_BORROWER_INPUTS);
const POLICY_FIELD_NAMES = Object.keys(DEFAULT_POLICY_INPUTS);
const PREVAILING_MARKET_CAP_PERIODS = [
  { start: "2021-07", end: "2021-08", rate: 0.053 },
  { start: "2021-09", end: "2021-09", rate: 0.042 },
  { start: "2021-10", end: "2021-12", rate: 0.041 },
  { start: "2022-01", end: "2022-02", rate: 0.044 },
  { start: "2022-09", end: "2022-11", rate: 0.063 },
  { start: "2022-12", end: "2023-02", rate: 0.065 },
  { start: "2023-03", end: "2023-05", rate: 0.069 },
  { start: "2023-06", end: "2023-08", rate: 0.071 },
  { start: "2023-09", end: "2023-11", rate: 0.073 },
  { start: "2023-12", end: "2023-12", rate: 0.075 },
  { start: "2024-01", end: "2024-02", rate: 0.076 },
  { start: "2024-03", end: "2024-03", rate: 0.077 },
  { start: "2024-04", end: "2024-05", rate: 0.078 },
  { start: "2024-06", end: "2024-07", rate: 0.079 },
  { start: "2024-08", end: "2024-08", rate: 0.08 },
];
const PREVAILING_MARKET_CAP_BY_TAX_YEAR = buildPrevailingMarketCapByTaxYear();
const YEARLY_COMPARISON_COLUMN_GROUPS = [
  {
    key: "lowerThreshold",
    label: "Lower Threshold",
    statusQuoField: "lowerThresholdStatusQuo",
    changedField: "lowerThresholdChanged",
    formatter: "currency",
  },
  {
    key: "upperThreshold",
    label: "Upper Threshold",
    statusQuoField: "upperThresholdStatusQuo",
    changedField: "upperThresholdChanged",
    formatter: "currency",
  },
  {
    key: "borrowerRate",
    label: "Rate",
    statusQuoField: "borrowerRateStatusQuo",
    changedField: "borrowerRateChanged",
    formatter: "pct",
  },
  {
    key: "borrowing",
    label: "Borrowing",
    statusQuoField: "borrowingStatusQuo",
    changedField: "borrowingChanged",
    formatter: "currency",
  },
  {
    key: "interest",
    label: "Interest",
    statusQuoField: "interestStatusQuo",
    changedField: "interestChanged",
    formatter: "currency",
  },
  {
    key: "repayment",
    label: "Repayment",
    statusQuoField: "repaymentStatusQuo",
    changedField: "repaymentChanged",
    formatter: "currency",
  },
  {
    key: "balance",
    label: "Balance",
    statusQuoField: "balanceStatusQuo",
    changedField: "balanceChanged",
    formatter: "currency",
  },
  {
    key: "rateNote",
    label: "Notes",
    statusQuoField: "rateNoteStatusQuo",
    changedField: "rateNoteChanged",
    formatter: "text",
    columnClass: "model-note-col",
  },
];

function parseYearMonth(ym) {
  const [yearText, monthText] = ym.split("-");
  return { year: Number(yearText), month: Number(monthText) };
}

function encodeYearMonth(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function nextYearMonth(year, month) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function toTaxYearEnding(month, year) {
  return month >= 4 ? year + 1 : year;
}

function buildPrevailingMarketCapByTaxYear() {
  const byTaxYear = {};

  for (const period of PREVAILING_MARKET_CAP_PERIODS) {
    const start = parseYearMonth(period.start);
    const end = parseYearMonth(period.end);
    let cursor = { ...start };

    while (true) {
      const monthKey = encodeYearMonth(cursor.year, cursor.month);
      const endKey = encodeYearMonth(end.year, end.month);
      if (monthKey > endKey) break;

      const taxYearEnding = toTaxYearEnding(cursor.month, cursor.year);
      byTaxYear[taxYearEnding] ??= [];
      byTaxYear[taxYearEnding].push(period.rate);

      cursor = nextYearMonth(cursor.year, cursor.month);
    }
  }

  return byTaxYear;
}

function parseInputSubsetFromParams(params, defaults, suffix = "") {
  const hydrated = { ...defaults };
  const fieldNames = Object.keys(defaults);

  for (const field of fieldNames) {
    const paramName = `${field}${suffix}`;
    if (!params.has(paramName)) continue;
    const raw = params.get(paramName);
    const defaultValue = defaults[field];

    if (typeof defaultValue === "number") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        hydrated[field] = parsed;
      }
      continue;
    }

    if (typeof defaultValue === "string" && typeof raw === "string") {
      hydrated[field] = raw;
    }
  }

  return hydrated;
}

function parseInputsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const borrowerInputs = parseInputSubsetFromParams(params, DEFAULT_BORROWER_INPUTS);
  const policyInputs = parseInputSubsetFromParams(params, DEFAULT_POLICY_INPUTS);

  if (!["build-up", "starting-balance"].includes(borrowerInputs.balanceMode)) {
    borrowerInputs.balanceMode = DEFAULT_BORROWER_INPUTS.balanceMode;
  }

  return { borrowerInputs, policyInputs };
}

function isEmbeddedInIframe() {
  try {
    return window.self !== window.top;
  } catch (_) {
    return true;
  }
}

function syncUrlWithInputs(borrowerInputs, policyInputs) {
  const params = new URLSearchParams();

  for (const field of BORROWER_FIELD_NAMES) {
    const value = borrowerInputs[field];
    const defaultValue = DEFAULT_BORROWER_INPUTS[field];
    if (value === defaultValue) continue;
    params.set(field, String(value));
  }
  for (const field of POLICY_FIELD_NAMES) {
    const value = policyInputs[field];
    const defaultValue = DEFAULT_POLICY_INPUTS[field];
    if (value === defaultValue) continue;
    params.set(field, String(value));
  }

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", nextUrl);
}

const CAREER_GROWTH_BANDS = [
  { minAge: 18, maxAge: 21, rate: 0.0382 },
  { minAge: 22, maxAge: 29, rate: 0.0244 },
  { minAge: 30, maxAge: 39, rate: 0.0078 },
  { minAge: 40, maxAge: 49, rate: -0.0046 },
  { minAge: 50, maxAge: 120, rate: -0.0133 },
];

// Hypothetical defaults intended to be replaced with real history.
const SERIES = {
  rpi: { 2013: 0.036, 2014: 0.033, 2015: 0.025, 2016: 0.009, 2017: 0.016, 2018: 0.031, 2019: 0.033, 2020: 0.024, 2021: 0.026, 2022: 0.015, 2023: 0.067, 2024: 0.077, 2025: 0.043, 2026: 0.03, 2027: 0.03, 2028: 0.03, 2029: 0.03, 2030: 0.021, 2031: 0.021, 2032: 0.021, 2033: 0.021, 2034: 0.021, 2035: 0.021, 2036: 0.021, 2037: 0.021, 2038: 0.021, 2039: 0.021, 2040: 0.021, 2041: 0.021, 2042: 0.021, 2043: 0.021, 2044: 0.021, 2045: 0.021, 2046: 0.021, 2047: 0.021, 2048: 0.021, 2049: 0.021, 2050: 0.021, 2051: 0.021, 2052: 0.021, 2053: 0.021, 2054: 0.021, 2055: 0.021, 2056: 0.021, 2057: 0.021, 2058: 0.021, 2059: 0.021, 2060: 0.021, },
  repaymentThreshold: { 2016: 21000, 2017: 21000, 2018: 25000, 2019: 25000, 2020: 25725, 2021: 26725, 2022: 27295, 2023: 27295, 2024: 27295, 2025: 27295, 2026: 29385, 2027: 29385, 2028: 29385, },
  higherInterestThreshold: { 2016: 41000, 2017: 41000, 2018: 45000, 2019: 46305, 2020: 47835, 2021: 49130, 2022: 49130, 2023: 49130, 2024: 51245, 2025: 51245, 2026: 52885, 2027: 52885, 2028: 52885, 2029: 52885, },
  awe: { 2013: 104.585707610209, 2014: 109.417612115425, 2015: 110.110016048805, 2016: 112.378080163611, 2017: 115.0884125336, 2018: 118.71158381233, 2019: 121.477053647363, 2020: 124.659226928468, 2021: 124.736737039507, 2022: 132.201009149403, 2023: 140.412025098435, 2024: 148.311409849505, 2025: 155.158695027451, 2026: 159.441705861328, 2027: 163.886552181829, 2028: 168.567877245132, 2029: 173.528884809793, 2030: 178.758207493962, 2031: 183.245038502061, 2032: 187.844488968462, 2033: 192.559385641571, 2034: 197.392626221174, 2035: 202.347181139326, 2036: 207.426095385923, 2037: 212.632490380109, 2038: 217.96956588865, 2039: 223.440601992455, 2040: 229.048961102466, 2041: 234.798090026138, 2042: 240.691522085794, 2043: 246.732879290147, 2044: 252.92587456033, 2045: 259.274314011794, 2046: 265.78209929349, 2047: 272.453229985757, 2048: 279.291806058399, 2049: 286.302030390465, 2050: 293.488211353265, 2051: 300.854765458232, 2052: 308.406220071234, 2053: 316.147216195022, 2054: 324.082511321517, 2055: 332.216982355687, 2056: 340.555628612815, 2057: 349.103574890996, 2058: 357.86607462076, 2059: 366.848513093741, 2060: 376.056410772394, }
};

function createYearRange(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function getCareerGrowthRate(age) {
  const band = CAREER_GROWTH_BANDS.find((item) => age >= item.minAge && age <= item.maxAge);
  return band ? band.rate : 0;
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function valuesDiffer(statusQuoValue, changedValue) {
  if (typeof statusQuoValue === "number" && typeof changedValue === "number") {
    return Math.abs(statusQuoValue - changedValue) > 1e-9;
  }
  return (statusQuoValue ?? "") !== (changedValue ?? "");
}

function isPlan2CohortYear(year) {
  return Number.isFinite(year) && year >= PLAN2_COHORT_MIN_YEAR && year <= PLAN2_COHORT_MAX_YEAR;
}

function buildSparseYearTicks(rows, targetTickCount = 12) {
  const years = [...new Set(rows.map((row) => row.year))];
  if (years.length === 0) return undefined;
  const step = Math.max(1, Math.ceil(years.length / targetTickCount));
  const ticks = years.filter((_, index) => index % step === 0);
  const lastYear = years[years.length - 1];
  if (ticks[ticks.length - 1] !== lastYear) ticks.push(lastYear);
  return ticks;
}

function buildRoundYearTicks(rows, targetTickCount = 10) {
  const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
  if (years.length === 0) return undefined;

  const minYear = years[0];
  const maxYear = years[years.length - 1];
  const span = Math.max(1, maxYear - minYear);
  const minStep = span / Math.max(1, targetTickCount);
  const stepOptions = [1, 2, 5, 10];
  const step = stepOptions.find((option) => option >= minStep) ?? 10;

  const firstRound = Math.ceil(minYear / step) * step;
  const ticks = [];
  for (let year = firstRound; year <= maxYear; year += step) {
    ticks.push(year);
  }

  if (ticks.length === 0) {
    ticks.push(minYear);
  }

  return ticks;
}

function buildRoundPercentTickSet(maxShare) {
  const maxPercent = Math.max(1, Math.ceil(maxShare * 100));
  const stepOptions = [0.5, 1, 2, 5, 10];
  const idealStep = maxPercent / 6;
  const step = stepOptions.find((option) => option >= idealStep) ?? 10;
  const ticks = [];
  for (let pct = 0; pct <= maxPercent + 1e-9; pct += step) {
    ticks.push(Number(pct.toFixed(2)));
  }
  if (ticks[ticks.length - 1] !== maxPercent) {
    ticks.push(maxPercent);
  }
  return { step, ticks };
}

function applyPrevailingMarketRateCap(taxYearEnding, baseBorrowerRate) {
  const cappedMonthRates = PREVAILING_MARKET_CAP_BY_TAX_YEAR[taxYearEnding];
  if (!cappedMonthRates || cappedMonthRates.length === 0) return baseBorrowerRate;

  const cappedRateSum = cappedMonthRates.reduce((sum, rate) => sum + rate, 0);
  const cappedMonths = cappedMonthRates.length;
  const uncappedMonths = Math.max(0, MONTHS_IN_YEAR - cappedMonths);
  const uncappedRateSum = uncappedMonths * baseBorrowerRate;

  return (cappedRateSum + uncappedRateSum) / MONTHS_IN_YEAR;
}

function buildFullSeries(years, inputs) {
  const rpi = {};
  const awe = {};
  const lowRate = {};
  const highRate = {};
  const hmtRate = {};
  const lowerThreshold = {};
  const upperThreshold = {};
  const baselineLowSpread = Math.min(
    DEFAULT_POLICY_INPUTS.lowRateSpreadOverRpi,
    DEFAULT_POLICY_INPUTS.highRateSpreadOverRpi
  );
  const baselineHighSpread = Math.max(
    DEFAULT_POLICY_INPUTS.lowRateSpreadOverRpi,
    DEFAULT_POLICY_INPUTS.highRateSpreadOverRpi
  );
  const adjustedLowSpread = Math.min(inputs.lowRateSpreadOverRpi, inputs.highRateSpreadOverRpi);
  const adjustedHighSpread = Math.max(inputs.lowRateSpreadOverRpi, inputs.highRateSpreadOverRpi);
  const rpiYears = Object.keys(SERIES.rpi).map(Number).sort((a, b) => a - b);
  const aweYears = Object.keys(SERIES.awe).map(Number).sort((a, b) => a - b);
  const lowerThresholdYears = Object.keys(SERIES.repaymentThreshold)
    .map(Number)
    .sort((a, b) => a - b);
  const upperThresholdYears = Object.keys(SERIES.higherInterestThreshold)
    .map(Number)
    .sort((a, b) => a - b);
  const firstRpiYear = rpiYears[0];
  const lastRpiYear = rpiYears[rpiYears.length - 1];
  const firstAweYear = aweYears[0];
  const lastAweYear = aweYears[aweYears.length - 1];
  const firstLowerThresholdYear = lowerThresholdYears[0];
  const firstUpperThresholdYear = upperThresholdYears[0];
  const aweFallbackGrowth =
    aweYears.length >= 2
      ? (SERIES.awe[lastAweYear] ?? 1) / Math.max(1, SERIES.awe[aweYears[aweYears.length - 2]] ?? 1) - 1
      : 0.02;

  for (const year of years) {
    if (year in SERIES.rpi) {
      rpi[year] = SERIES.rpi[year];
    } else if (year > lastRpiYear) {
      rpi[year] = POST_SERIES_RPI;
    } else if (year < firstRpiYear) {
      rpi[year] = SERIES.rpi[firstRpiYear] ?? POST_SERIES_RPI;
    } else {
      rpi[year] = POST_SERIES_RPI;
    }

    if (year in SERIES.awe) {
      awe[year] = SERIES.awe[year];
    } else if (year > lastAweYear) {
      const prev = awe[year - 1] ?? SERIES.awe[lastAweYear] ?? 100;
      awe[year] = prev * (1 + aweFallbackGrowth);
    } else if (year < firstAweYear) {
      awe[year] = SERIES.awe[firstAweYear] ?? 100;
    } else {
      awe[year] = 100;
    }

    const useAdjustedSpreads = year >= PROJECTION_START_YEAR;
    const lowSpread = useAdjustedSpreads ? adjustedLowSpread : baselineLowSpread;
    const highSpread = useAdjustedSpreads ? adjustedHighSpread : baselineHighSpread;
    lowRate[year] = rpi[year] + lowSpread;
    highRate[year] = rpi[year] + highSpread;
    hmtRate[year] = year > 2030 ? rpi[year] + 0.0005 : rpi[year] - 0.0085;

    if (year in SERIES.repaymentThreshold) {
      lowerThreshold[year] = SERIES.repaymentThreshold[year];
    } else if (year < firstLowerThresholdYear) {
      lowerThreshold[year] = SERIES.repaymentThreshold[firstLowerThresholdYear] ?? 27295;
    } else {
      const prev = lowerThreshold[year - 1] ?? 27295;
      const aweRatio = (awe[year] ?? 1) / (awe[year - 1] ?? 1);
      lowerThreshold[year] = prev * aweRatio;
    }

    if (year in SERIES.higherInterestThreshold) {
      upperThreshold[year] = SERIES.higherInterestThreshold[year];
    } else if (year < firstUpperThresholdYear) {
      upperThreshold[year] = SERIES.higherInterestThreshold[firstUpperThresholdYear] ?? 52885;
    } else {
      const prev = upperThreshold[year - 1] ?? 52885;
      const aweRatio = (awe[year] ?? 1) / (awe[year - 1] ?? 1);
      upperThreshold[year] = prev * aweRatio;
    }
  }

  const lowerForecastFactor = Math.max(0.1, 1 + (inputs.lowerThresholdForecastAdj ?? 0));
  const upperForecastFactor = Math.max(0.1, 1 + (inputs.upperThresholdForecastAdj ?? 0));
  for (const year of years) {
    if (year >= PROJECTION_START_YEAR) {
      lowerThreshold[year] *= lowerForecastFactor;
      upperThreshold[year] *= upperForecastFactor;
    }
  }

  return { rpi, awe, lowRate, highRate, hmtRate, lowerThreshold, upperThreshold };
}

function deriveLifeStage(year, graduationYear, writeoffYears, studyYears) {
  const yearsSinceGraduation = year - graduationYear;
  if (yearsSinceGraduation < -studyYears) return "Non-university";
  if (yearsSinceGraduation < 0) return "Studying";
  if (yearsSinceGraduation < writeoffYears) return "Liable to repay";
  return "Written-off";
}

function computeModel(borrowerInputs, policyInputs, endYearOverride = null) {
  if (!isPlan2CohortYear(borrowerInputs.graduationYear)) {
    return {
      rows: [],
      summary: {
        faceValue2025: 0,
        totalRepaid: 0,
        totalInterest: 0,
        npvHmt: 0,
        npvMarket: 0,
        npvBorrower: 0,
        rabCharge: 0,
        pctFaceHmt: 0,
        pctFaceMarket: 0,
        pctFaceBorrower: 0,
        writtenOffAmount: 0,
        debtClearedYear: null,
      },
    };
  }

  const baseEndYear = Math.max(
    DEFAULT_END_YEAR,
    borrowerInputs.graduationYear + policyInputs.writeoffYears + 2
  );
  const endYear =
    Number.isFinite(endYearOverride) ? Math.max(baseEndYear, Number(endYearOverride)) : baseEndYear;
  const years = createYearRange(START_YEAR, endYear);
  const series = buildFullSeries(years, policyInputs);
  const rows = [];

  let prevBalance = 0;
  let prevIncome = 0;
  let marketDf = 1;
  let hmtDf = 1;
  let borrowerDf = 1;
  let debtClearedYear = null;
  let writtenOffAmount = 0;
  let writeOffCaptured = false;

  for (const year of years) {
    const age = 18 + borrowerInputs.studyYears + (year - borrowerInputs.graduationYear);
    const lifeStage = deriveLifeStage(
      year,
      borrowerInputs.graduationYear,
      policyInputs.writeoffYears,
      borrowerInputs.studyYears
    );

    let income = 0;
    if (year === borrowerInputs.graduationYear) {
      income = borrowerInputs.startingSalary;
    } else if (year > borrowerInputs.graduationYear) {
      const careerGrowth = getCareerGrowthRate(age);
      const aweRatio = (series.awe[year] ?? 1) / (series.awe[year - 1] ?? 1);
      income = prevIncome * (1 + careerGrowth) * aweRatio;
    }

    const lowerThreshold = series.lowerThreshold[year] ?? 0;
    const upperThreshold = series.upperThreshold[year] ?? lowerThreshold;

    let borrowerRate = 0;
    if (prevBalance <= 0 && lifeStage !== "Studying") {
      borrowerRate = 0;
    } else if (lifeStage === "Studying") {
      borrowerRate = series.highRate[year] ?? 0;
    } else if (income > upperThreshold) {
      borrowerRate = series.highRate[year] ?? 0;
    } else if (income <= lowerThreshold) {
      borrowerRate = series.lowRate[year] ?? 0;
    } else {
      const share = (income - lowerThreshold) / Math.max(1, upperThreshold - lowerThreshold);
      borrowerRate = (series.lowRate[year] ?? 0) + share * ((series.highRate[year] ?? 0) - (series.lowRate[year] ?? 0));
    }
    if (borrowerRate > 0 && lifeStage !== "Written-off") {
      borrowerRate = applyPrevailingMarketRateCap(year, borrowerRate);
    }

    const borrowing =
      lifeStage === "Studying" && borrowerInputs.balanceMode === "build-up"
        ? borrowerInputs.tuitionFee + borrowerInputs.maintenanceLoan
        : 0;
    const midYearBalance = prevBalance + borrowing / 2;

    let interest = 0;
    if (lifeStage !== "Written-off") {
      interest = midYearBalance * borrowerRate;
    }

    let repayment = 0;
    if (lifeStage === "Liable to repay") {
      const rawRepayment = Math.max(0, (income - lowerThreshold) * policyInputs.repaymentRate);
      const cap = midYearBalance + interest;
      repayment = -Math.min(rawRepayment, Math.max(0, cap));
    }

    const rawBalance = prevBalance + borrowing + interest + repayment;
    let balance = rawBalance;
    if (borrowerInputs.balanceMode === "starting-balance" && year === 2025) {
      balance = Math.max(0, borrowerInputs.startingBalance2025);
    }
    if (lifeStage === "Written-off") {
      if (!writeOffCaptured) {
        writtenOffAmount = Math.max(0, prevBalance);
        writeOffCaptured = true;
      }
      balance = 0;
    }
    if (balance < 0.01) {
      balance = 0;
    }

    if (debtClearedYear === null && lifeStage === "Liable to repay" && prevBalance > 0 && balance === 0) {
      debtClearedYear = year;
    }

    if (year >= PROJECTION_START_YEAR) {
      hmtDf /= 1 + (series.hmtRate[year] ?? 0);
      marketDf /= 1 + MARKET_DISCOUNT_RATE;
      borrowerDf /= 1 + borrowerRate;
    }

    const pvHmt = year >= PROJECTION_START_YEAR ? -repayment * hmtDf : 0;
    const pvMarket = year >= PROJECTION_START_YEAR ? -repayment * marketDf : 0;
    const pvBorrower = year >= PROJECTION_START_YEAR ? -repayment * borrowerDf : 0;
    const pmrCapMonths = PREVAILING_MARKET_CAP_BY_TAX_YEAR[year]?.length ?? 0;
    const rateNote = pmrCapMonths > 0 ? "PMR" : "";

    rows.push({
      year,
      age,
      lifeStage,
      income: roundCurrency(income),
      lowerThreshold: roundCurrency(lowerThreshold),
      upperThreshold: roundCurrency(upperThreshold),
      borrowerRate,
      borrowing: roundCurrency(borrowing),
      midYearBalance: roundCurrency(midYearBalance),
      interest: roundCurrency(interest),
      repayment: roundCurrency(repayment),
      netChange: roundCurrency(balance - prevBalance),
      balance: roundCurrency(balance),
      hmtRate: series.hmtRate[year] ?? 0,
      pvHmt: roundCurrency(pvHmt),
      pvMarket: roundCurrency(pvMarket),
      pvBorrower: roundCurrency(pvBorrower),
      rateNote,
    });

    prevBalance = balance;
    prevIncome = income;
  }

  const faceValue2025 = rows.find((r) => r.year === 2025)?.balance ?? 0;
  const totalRepaid = -rows.reduce((sum, r) => sum + (r.repayment < 0 ? r.repayment : 0), 0);
  const totalInterest = rows.reduce((sum, r) => sum + r.interest, 0);
  const npvHmt = rows.reduce((sum, r) => sum + r.pvHmt, 0);
  const npvMarket = rows.reduce((sum, r) => sum + r.pvMarket, 0);
  const npvBorrower = rows.reduce((sum, r) => sum + r.pvBorrower, 0);
  const rabCharge = faceValue2025 > 0 ? (faceValue2025 - npvHmt) / faceValue2025 : 0;
  const pctFaceHmt = faceValue2025 > 0 ? npvHmt / faceValue2025 : 0;
  const pctFaceMarket = faceValue2025 > 0 ? npvMarket / faceValue2025 : 0;
  const pctFaceBorrower = faceValue2025 > 0 ? npvBorrower / faceValue2025 : 0;

  return {
    rows,
    summary: {
      faceValue2025,
      totalRepaid,
      totalInterest,
      npvHmt,
      npvMarket,
      npvBorrower,
      rabCharge,
      pctFaceHmt,
      pctFaceMarket,
      pctFaceBorrower,
      writtenOffAmount,
      debtClearedYear,
    },
  };
}

createApp({
  setup() {
    const initialUrlState = parseInputsFromUrl();
    const borrowerInputs = reactive(initialUrlState.borrowerInputs);
    const policyInputs = reactive(initialUrlState.policyInputs);
    const isEmbedded = ref(isEmbeddedInIframe());

    const modelEndYear = computed(() =>
      Math.max(
        DEFAULT_END_YEAR,
        borrowerInputs.graduationYear + policyInputs.writeoffYears + 2
      )
    );
    const model = computed(() => computeModel(borrowerInputs, policyInputs, modelEndYear.value));
    const statusQuoModel = computed(() =>
      computeModel(borrowerInputs, DEFAULT_POLICY_INPUTS, modelEndYear.value)
    );
    const modelRows = computed(() => model.value.rows);
    const statusQuoRows = computed(() => statusQuoModel.value.rows);
    const summary = computed(() => model.value.summary);
    const statusQuoSummary = computed(() => statusQuoModel.value.summary);
    const isCohortEligible = computed(() => isPlan2CohortYear(borrowerInputs.graduationYear));

    function buildValuationRows(summaryValue) {
      return [
        {
          method: "Government / HMT",
          discountRate: "Year-specific HMT",
          npv: summaryValue.npvHmt,
          pctFace: summaryValue.pctFaceHmt,
          rabCharge: summaryValue.rabCharge,
        },
        {
          method: "Market",
          discountRate: `${(MARKET_DISCOUNT_RATE * 100).toFixed(1)}% fixed`,
          npv: summaryValue.npvMarket,
          pctFace: summaryValue.pctFaceMarket,
          rabCharge: null,
        },
        {
          method: "ONS",
          discountRate: "Borrower interest rate",
          npv: summaryValue.npvBorrower,
          pctFace: summaryValue.pctFaceBorrower,
          rabCharge: null,
        },
      ];
    }

    const valuationComparisonRows = computed(() => {
      const changedValuations = buildValuationRows(summary.value);
      const statusQuoValuations = buildValuationRows(statusQuoSummary.value);
      return changedValuations.map((row, index) => {
        const statusQuoRow = statusQuoValuations[index];
        return {
          method: row.method,
          discountRate: row.discountRate,
          npvStatusQuo: statusQuoRow.npv,
          npvChanged: row.npv,
          npvDelta: row.npv - statusQuoRow.npv,
          pctFaceStatusQuo: statusQuoRow.pctFace,
          pctFaceChanged: row.pctFace,
          pctFaceDelta: row.pctFace - statusQuoRow.pctFace,
          rabChargeStatusQuo: statusQuoRow.rabCharge,
          rabChargeChanged: row.rabCharge,
          rabChargeDelta:
            row.rabCharge === null || statusQuoRow.rabCharge === null ? null : row.rabCharge - statusQuoRow.rabCharge,
        };
      });
    });

    const yearlyComparisonRows = computed(() => {
      const statusQuoByYear = new Map(statusQuoRows.value.map((row) => [row.year, row]));
      return modelRows.value.map((changedRow) => {
        const statusQuoRow = statusQuoByYear.get(changedRow.year);
        return {
          year: changedRow.year,
          lifeStage: changedRow.lifeStage,
          age: changedRow.age,
          incomeStatusQuo: statusQuoRow?.income ?? null,
          incomeChanged: changedRow.income,
          lowerThresholdStatusQuo: statusQuoRow?.lowerThreshold ?? null,
          lowerThresholdChanged: changedRow.lowerThreshold,
          upperThresholdStatusQuo: statusQuoRow?.upperThreshold ?? null,
          upperThresholdChanged: changedRow.upperThreshold,
          borrowerRateStatusQuo: statusQuoRow?.borrowerRate ?? null,
          borrowerRateChanged: changedRow.borrowerRate,
          borrowingStatusQuo: statusQuoRow?.borrowing ?? null,
          borrowingChanged: changedRow.borrowing,
          interestStatusQuo: statusQuoRow?.interest ?? null,
          interestChanged: changedRow.interest,
          repaymentStatusQuo: statusQuoRow?.repayment ?? null,
          repaymentChanged: changedRow.repayment,
          balanceStatusQuo: statusQuoRow?.balance ?? null,
          balanceChanged: changedRow.balance,
          rateNoteStatusQuo: statusQuoRow?.rateNote ?? "",
          rateNoteChanged: changedRow.rateNote,
        };
      });
    });

    const yearlyComparisonDisplayGroups = computed(() =>
      YEARLY_COMPARISON_COLUMN_GROUPS.map((group) => ({
        ...group,
        hasDifference: yearlyComparisonRows.value.some((row) =>
          valuesDiffer(row[group.statusQuoField], row[group.changedField])
        ),
      }))
    );

    const comparisonSummaryCards = computed(() => {
      return [
        {
          key: "totalRepaid",
          label: "Total Repaid",
          statusQuo: statusQuoSummary.value.totalRepaid,
          changed: summary.value.totalRepaid,
          formatter: "currency",
        },
        {
          key: "totalInterest",
          label: "Total Interest Accrued",
          statusQuo: statusQuoSummary.value.totalInterest,
          changed: summary.value.totalInterest,
          formatter: "currency",
        },
        {
          key: "loanOutcome",
          label: "Loan Outcome",
          statusQuo: statusQuoSummary.value,
          changed: summary.value,
          formatter: "outcome",
          showDelta: false,
        },
      ];
    });

    const balanceChart = ref(null);
    const flowChartChanged = ref(null);
    const flowChartStatusQuo = ref(null);
    const incomeChartPrimary = ref(null);
    const incomeChartSecondary = ref(null);

    function renderCharts() {
      if (
        !balanceChart.value ||
        !flowChartChanged.value ||
        !flowChartStatusQuo.value ||
        !incomeChartPrimary.value ||
        !incomeChartSecondary.value
      ) {
        return;
      }
      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue("--accent").trim() || "#3a75b5";
      const compareAccent = css.getPropertyValue("--compare-accent").trim() || "#c62828";

      balanceChart.value.replaceChildren();
      flowChartChanged.value.replaceChildren();
      flowChartStatusQuo.value.replaceChildren();
      incomeChartPrimary.value.replaceChildren();
      incomeChartSecondary.value.replaceChildren();

      const balanceMarks = [
        Plot.line(modelRows.value, { x: "year", y: "balance", stroke: accent, strokeWidth: 2 }),
      ];
      if (statusQuoRows.value.length > 0) {
        balanceMarks.push(
          Plot.line(statusQuoRows.value, {
            x: "year",
            y: "balance",
            stroke: compareAccent,
            strokeWidth: 2,
            strokeDasharray: "6,4",
          })
        );
      }
      balanceMarks.push(Plot.ruleY([0]));

      const balancePlot = Plot.plot({
        width: balanceChart.value.clientWidth || 560,
        height: 320,
        marginLeft: 70,
        y: { label: "Balance (£)", grid: true },
        x: { label: "Tax year ending", tickFormat: (year) => `${year}` },
        marks: balanceMarks,
      });

      const flowRowsChanged = modelRows.value.filter((row) => row.lifeStage !== "Written-off");
      const flowRowsStatusQuo = statusQuoRows.value.filter((row) => row.lifeStage !== "Written-off");
      const flowComponentsChanged = flowRowsChanged.flatMap((row) => [
        { year: row.year, metric: "Borrowing", value: row.borrowing },
        { year: row.year, metric: "Interest", value: row.interest },
        { year: row.year, metric: "Repayment", value: row.repayment },
      ]);
      const flowComponentsStatusQuo = flowRowsStatusQuo.flatMap((row) => [
        { year: row.year, metric: "Borrowing", value: row.borrowing },
        { year: row.year, metric: "Interest", value: row.interest },
        { year: row.year, metric: "Repayment", value: row.repayment },
      ]);
      const flowNetChanged = flowRowsChanged.map((row) => ({ year: row.year, value: row.netChange }));
      const flowNetStatusQuo = flowRowsStatusQuo.map((row) => ({ year: row.year, value: row.netChange }));
      const flowTickRows = flowRowsChanged.length > 0 ? flowRowsChanged : flowRowsStatusQuo;
      const flowTicks = buildRoundYearTicks(flowTickRows, 10) ?? buildSparseYearTicks(flowTickRows, 10);
      const combinedFlowValues = [
        ...flowComponentsChanged.map((point) => point.value),
        ...flowComponentsStatusQuo.map((point) => point.value),
        ...flowNetChanged.map((point) => point.value),
        ...flowNetStatusQuo.map((point) => point.value),
      ];
      const flowMin = Math.min(0, ...combinedFlowValues);
      const flowMax = Math.max(0, ...combinedFlowValues);
      const flowPadding = Math.max(250, (flowMax - flowMin) * 0.08);
      const flowYDomain = [flowMin - flowPadding, flowMax + flowPadding];
      const flowColor = {
        domain: ["Borrowing", "Interest", "Repayment"],
        range: ["#0072B2", "#E69F00", "#009E73"],
      };

      function buildFlowPlot(flowComponents, flowNet, strokeColor, width) {
        return Plot.plot({
          width,
          height: 320,
          marginLeft: 72,
          y: { label: "Annual £", grid: true, domain: flowYDomain },
          x: { label: "Tax year ending", tickFormat: (year) => `${year}`, ticks: flowTicks },
          color: flowColor,
          marks: [
            Plot.barY(flowComponents, { x: "year", y: "value", fill: "metric" }),
            Plot.lineY(flowNet, { x: "year", y: "value", stroke: strokeColor, strokeWidth: 2.2 }),
            Plot.ruleY([0]),
          ],
        });
      }

      const flowChangedPlot = buildFlowPlot(
        flowComponentsChanged,
        flowNetChanged,
        accent,
        flowChartChanged.value.clientWidth || 560
      );
      const flowStatusQuoPlot = buildFlowPlot(
        flowComponentsStatusQuo,
        flowNetStatusQuo,
        compareAccent,
        flowChartStatusQuo.value.clientWidth || 560
      );

      balanceChart.value.append(balancePlot);
      flowChartChanged.value.append(flowChangedPlot);
      flowChartStatusQuo.value.append(flowStatusQuoPlot);

      const incomeRowsChanged = modelRows.value.map((row) => {
        const repaymentTaken = Math.max(0, -row.repayment);
        const takeHome = Math.max(0, row.income - repaymentTaken);
        const repaymentShare = row.income > 0 ? repaymentTaken / row.income : 0;
        return {
          year: row.year,
          income: row.income,
          takeHome,
          lowerThreshold: row.lowerThreshold,
          upperThreshold: row.upperThreshold,
          repaymentTaken,
          repaymentShare,
          repaymentShareScaled: 0, // filled below once max income is known
        };
      });
      const incomeRowsStatusQuo = statusQuoRows.value.map((row) => {
        const repaymentTaken = Math.max(0, -row.repayment);
        const takeHome = Math.max(0, row.income - repaymentTaken);
        const repaymentShare = row.income > 0 ? repaymentTaken / row.income : 0;
        return {
          year: row.year,
          income: row.income,
          takeHome,
          lowerThreshold: row.lowerThreshold,
          upperThreshold: row.upperThreshold,
          repaymentTaken,
          repaymentShare,
          repaymentShareScaled: 0,
        };
      });
      const maxIncome = Math.max(1, ...incomeRowsChanged.map((row) => row.income), ...incomeRowsStatusQuo.map((row) => row.income));
      const maxThreshold = Math.max(
        1,
        ...incomeRowsChanged.map((row) => row.lowerThreshold),
        ...incomeRowsChanged.map((row) => row.upperThreshold),
        ...incomeRowsStatusQuo.map((row) => row.lowerThreshold),
        ...incomeRowsStatusQuo.map((row) => row.upperThreshold)
      );
      const incomeAxisMax = Math.max(maxIncome, maxThreshold);
      const maxRepaymentShare = Math.max(
        0.01,
        ...incomeRowsChanged.map((row) => row.repaymentShare),
        ...incomeRowsStatusQuo.map((row) => row.repaymentShare)
      );
      const shareAxisMax = Math.ceil(maxRepaymentShare * 100) / 100;
      const shareTicksPct = buildRoundPercentTickSet(shareAxisMax).ticks;
      const shareTicksScaled = shareTicksPct.map((pct) => (pct / 100 / shareAxisMax) * incomeAxisMax);
      for (const row of incomeRowsChanged) {
        row.repaymentShareScaled = (row.repaymentShare / shareAxisMax) * incomeAxisMax;
      }
      for (const row of incomeRowsStatusQuo) {
        row.repaymentShareScaled = (row.repaymentShare / shareAxisMax) * incomeAxisMax;
      }

      function buildIncomePlot(rows, incomeStroke, shareStroke, width) {
        return Plot.plot({
          width,
          height: 320,
          marginLeft: 70,
          marginRight: 78,
          y: { label: "Income (£)", grid: true, domain: [0, incomeAxisMax] },
          x: { label: "Tax year ending", tickFormat: (year) => `${year}` },
          marks: [
            Plot.areaY(rows, {
              x: "year",
              y1: "income",
              y2: "takeHome",
              fill: "#f4b183",
              fillOpacity: 0.8,
            }),
            Plot.line(rows, { x: "year", y: "income", stroke: incomeStroke, strokeWidth: 2 }),
            Plot.line(rows, {
              x: "year",
              y: "lowerThreshold",
              stroke: "#1f4f99",
              strokeWidth: 1.5,
              strokeDasharray: "4,4",
            }),
            Plot.line(rows, {
              x: "year",
              y: "upperThreshold",
              stroke: "#6e6e6e",
              strokeWidth: 1.5,
              strokeDasharray: "2,4",
            }),
            Plot.line(rows, {
              x: "year",
              y: "repaymentShareScaled",
              stroke: shareStroke,
              strokeWidth: 1.8,
              strokeDasharray: "5,4",
            }),
            Plot.axisY({ anchor: "left" }),
            Plot.axisY({
              anchor: "right",
              label: "Repayment as % of income",
              ticks: shareTicksScaled,
              tickFormat: (value) => `${(((value / incomeAxisMax) * shareAxisMax) * 100).toFixed(1)}%`,
            }),
            Plot.ruleY([0]),
          ],
        });
      }

      const incomePlotChanged = buildIncomePlot(
        incomeRowsChanged,
        accent,
        "#b04a00",
        incomeChartPrimary.value.clientWidth || 560
      );
      const incomePlotStatusQuo = buildIncomePlot(
        incomeRowsStatusQuo,
        compareAccent,
        "#5a5a5a",
        incomeChartSecondary.value.clientWidth || 560
      );

      incomeChartPrimary.value.append(incomePlotChanged);
      incomeChartSecondary.value.append(incomePlotStatusQuo);
    }

    onMounted(() => {
      renderCharts();
      window.addEventListener("resize", renderCharts);
      window.addEventListener("popstate", () => {
        const urlInputs = parseInputsFromUrl();
        for (const field of BORROWER_FIELD_NAMES) {
          borrowerInputs[field] = urlInputs.borrowerInputs[field];
        }
        for (const field of POLICY_FIELD_NAMES) {
          policyInputs[field] = urlInputs.policyInputs[field];
        }
      });
    });

    watch([modelRows, statusQuoRows], () => {
      renderCharts();
    });

    watch(
      [borrowerInputs, policyInputs],
      () => {
        syncUrlWithInputs(borrowerInputs, policyInputs);
      },
      { deep: true }
    );

    function formatCurrency(value) {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
      }).format(value ?? 0);
    }

    function formatPct(value) {
      return `${((value ?? 0) * 100).toFixed(1)}%`;
    }

    function formatLoanOutcome(summaryValue) {
      if (!summaryValue) return "—";
      if ((summaryValue.writtenOffAmount ?? 0) > 0) {
        return `Written off: ${formatCurrency(summaryValue.writtenOffAmount)}`;
      }
      if (summaryValue.debtClearedYear !== null) {
        return `Paid off in ${summaryValue.debtClearedYear}`;
      }
      return "No payoff or write-off in model horizon";
    }

    function formatCardValue(item, value) {
      if (item.formatter === "pct") return formatPct(value);
      if (item.formatter === "outcome") return formatLoanOutcome(value);
      return formatCurrency(value);
    }

    function formatCardDelta(item) {
      if (item.formatter === "pct") return formatPct(item.changed - item.statusQuo);
      return formatCurrency(item.changed - item.statusQuo);
    }

    function formatYearlyComparisonValue(value, formatter) {
      if (formatter === "pct") return formatPct(value);
      if (formatter === "text") return value || "—";
      return formatCurrency(value);
    }

    function toPctInput(value) {
      return (value ?? 0) * 100;
    }

    function updatePctInput(fieldName, rawValue) {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) return;
      if (fieldName in policyInputs) {
        policyInputs[fieldName] = parsed / 100;
      }
    }

    function resetField(fieldName) {
      if (fieldName in DEFAULT_BORROWER_INPUTS) {
        borrowerInputs[fieldName] = DEFAULT_BORROWER_INPUTS[fieldName];
      }
      if (fieldName in DEFAULT_POLICY_INPUTS) {
        policyInputs[fieldName] = DEFAULT_POLICY_INPUTS[fieldName];
      }
    }

    function resetPolicyFields() {
      for (const [field, value] of Object.entries(DEFAULT_POLICY_INPUTS)) {
        policyInputs[field] = value;
      }
    }

    function resetAllFields() {
      for (const [field, value] of Object.entries(DEFAULT_BORROWER_INPUTS)) {
        borrowerInputs[field] = value;
      }
      for (const [field, value] of Object.entries(DEFAULT_POLICY_INPUTS)) {
        policyInputs[field] = value;
      }
    }

    function applyBorrowerPreset(presetName) {
      const preset = BORROWER_PRESETS[presetName];
      if (!preset) return;
      borrowerInputs.graduationYear = preset.graduationYear;
      borrowerInputs.startingSalary = preset.startingSalary;
    }

    function isBorrowerPresetActive(presetName) {
      const preset = BORROWER_PRESETS[presetName];
      if (!preset) return false;
      return (
        borrowerInputs.graduationYear === preset.graduationYear &&
        borrowerInputs.startingSalary === preset.startingSalary
      );
    }

    async function shareScenario() {
      syncUrlWithInputs(borrowerInputs, policyInputs);
      const shareUrl = window.location.href;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          window.alert("Scenario link copied to clipboard.");
          return;
        }
      } catch (_) {
        // Fall through to legacy copy path below.
      }

      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (copied) {
        window.alert("Scenario link copied to clipboard.");
        return;
      }
      window.alert(`Copy this scenario URL: ${shareUrl}`);
    }

    return {
      borrowerInputs,
      policyInputs,
      isEmbedded,
      modelRows,
      statusQuoRows,
      summary,
      statusQuoSummary,
      isCohortEligible,
      valuationComparisonRows,
      yearlyComparisonRows,
      yearlyComparisonDisplayGroups,
      comparisonSummaryCards,
      balanceChart,
      flowChartChanged,
      flowChartStatusQuo,
      incomeChartPrimary,
      incomeChartSecondary,
      formatCurrency,
      formatPct,
      formatCardValue,
      formatCardDelta,
      formatYearlyComparisonValue,
      toPctInput,
      updatePctInput,
      resetField,
      resetPolicyFields,
      resetAllFields,
      applyBorrowerPreset,
      isBorrowerPresetActive,
      shareScenario,
    };
  },
}).mount("#app");
