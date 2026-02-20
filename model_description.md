# UK Plan 2 Student Loan Repayment Model

## Overview

This spreadsheet models a **hypothetical UK Plan 2 student loan** for a single borrower, projecting the loan balance, annual repayments, interest accrual, and income trajectory from university entry through to write-off (30 years after graduation). It then computes the **Net Present Value (NPV)** of repayments under three discount rate methodologies and derives a **RAB charge** (the government's expected loss).

---

## 1. Input Assumptions (User-Configurable)

| Parameter | Location | Default Value | Description |
|---|---|---|---|
| **Commercial Discount Rate** | `E4` | `8%` | Used for "Market" NPV valuation |
| **Graduation Year** | `E24` | `2016` | Year the borrower graduates (age 21) |
| **Starting Income (Year of Graduation)** | `K29` | `£25,000` | Borrower's income in their graduation year |
| **Tuition Fees** | Row 20 per year | `£9,000` | Annual tuition fee (hardcoded per year, all years use £9,000) |
| **Maintenance Loan** | Row 21 per year | Varies | Annual maintenance loan drawn (historical actuals used; varies by year) |

### Macroeconomic Assumptions (per year, in row 6 onwards)

| Parameter | Row | Notes |
|---|---|---|
| **RPI (Retail Price Index)** | 6 | Historical actuals to ~2024, then **2.1% flat from 2025 onwards** (with 3% used for the "RPI after 2026" assumption in `D9`) |
| **HMT Discount Rate** | 7 | Formula: `RPI + 0.05%` if year ≥ 2030, else `RPI − 0.85%` |
| **Low Interest Rate** | 9 | Equals RPI (historical); **3% flat** from 2026 onwards |
| **High Interest Rate** | 10 | Equals historical rate; **RPI + 3%** (i.e., **6%**) from 2026 onwards |
| **Average Weekly Earnings Index** | 12 | Historical ONS index (2008 Q1 = 100); forecast from row 13 for future years |
| **Income Threshold (Repayment)** | 16 | Historical actuals; from 2029 onwards grows with the weekly earnings forecast ratio |
| **Higher Interest Threshold** | 17 | Historical actuals; from 2030 onwards grows with the weekly earnings forecast ratio |

---

## 2. Wage/Age Profile (Sheet3)

Derives **annualised career wage growth rates** by age band from ONS median weekly earnings data:

| Age Band | Median Weekly Earnings (£) | Median Age | Annual Career Growth Rate |
|---|---|---|---|
| 18–21 → 22–29 | 498.5 → 648.2 | 19 → 26 | **3.82%** |
| 22–29 → 30–39 | 648.2 → 805.2 | 26 → 35 | **2.44%** |
| 30–39 → 40–49 | 805.2 → 870.0 | 35 → 45 | **0.78%** |
| 40–49 → 50–59 | 870.0 → 831.0 | 45 → 55 | **−0.46%** |
| 50–59 → 60+ | 831.0 → 726.7 | 55 → 65 | **−1.33%** |

**Formula**: `Growth = (Wage_next / Wage_current) ^ (1 / (Age_next − Age_current)) − 1`

These rates are looked up by the borrower's age each year to determine their **relative wage growth**.

---

## 3. Borrower Income Projection (Row 29)

- **During study (years before graduation)**: Income = `0`
- **Year of graduation**: Income = user-supplied starting income (£25,000)
- **Subsequent years**: `Income_t = Income_{t-1} × (1 + career_growth_rate) × (AWE_index_t / AWE_index_{t-1})`
  - The career growth rate comes from the Sheet3 age-band lookup
  - The AWE index ratio captures economy-wide wage inflation on top of the age-progression effect

---

## 4. Interest Rate Calculation (Row 31)

Plan 2 uses a **sliding scale** interest rate based on income:

```
IF loan_balance ≤ 0:         rate = 0
IF studying:                  rate = High Rate (RPI + 3%)
IF income > upper_threshold:  rate = High Rate
IF income ≤ lower_threshold:  rate = Low Rate (RPI)
ELSE:                         rate = Low Rate + (income − lower_threshold) / 
                                     (upper_threshold − lower_threshold) × (High Rate − Low Rate)
```

- **Lower threshold** (row 16): £27,295 (frozen 2022–2025), then grows with wages
- **Upper threshold** (row 17): ~£49,130–£52,885 range, then grows with wages

---

## 5. Loan Balance Mechanics

### Life Stage Logic (Row 25)

```
IF years_since_graduation < −3:  "Non-university"
IF years_since_graduation < 0:   "Studying"
IF years_since_graduation < 30:  "Repaying"
ELSE:                            "Written-off"
```

The borrower is modelled as studying for 3 years before graduation year, then repaying for 30 years.

### Annual Loan Balance (Row 35)

```
Balance_t = Balance_{t-1} + Borrowing_t + Interest_t + Repayments_t
```

If life stage = "Written-off", balance is set to **0** (the remaining debt is cancelled).

### Borrowing (Row 36)

```
IF studying: Tuition Fees + Maintenance Loan
ELSE: 0
```

### Interest (Row 37)

Interest is calculated on a **mid-year balance** (circularity-protected):

```
Mid-year balance = Previous year's closing balance + (This year's borrowing / 2)
Interest = Interest Rate × Mid-year balance
```

### Repayments (Row 38)

Repayments are **negative** (reduce the balance):

```
Repayment = −MIN( MAX(0, (Income − Repayment_Threshold) × 9%), Mid-year_balance + Interest )
```

- **9%** of income above the repayment threshold
- Capped so the borrower never repays more than the outstanding balance + interest
- During the write-off year, repayment is capped at the mid-year balance only (no interest added)

---

## 6. NPV Valuation (Rows 40–52)

Three present value calculations of the repayment stream, all discounted **from 2026** (the first projection year):

### Method 1: Government / HMT Rate

- **Discount rate**: HMT rate = `RPI + 0.05%` (from 2030) or `RPI − 0.85%` (before 2030)
- Cumulative discount factor: `DF_t = DF_{t-1} / (1 + HMT_rate_t)`
- `PV_t = −Repayment_t × DF_t`

### Method 2: Market Rate (8%)

- **Discount rate**: Fixed **8%** (from `E4`)
- Cumulative discount factor: `DF_t = DF_{t-1} / (1 + 8%)`
- `PV_t = −Repayment_t × DF_t`

### Method 3: ONS / Borrower Rate

- **Discount rate**: The borrower's own **interest rate** for that year (from Row 31)
- Cumulative discount factor: `DF_t = DF_{t-1} / (1 + borrower_interest_rate_t)`
- `PV_t = −Repayment_t × DF_t`

---

## 7. Summary Outputs (Rows 55–61)

| Metric | Formula | Example Value |
|---|---|---|
| **NPV — Government (HMT)** | `SUM(PV repayments, 2026–2045)` | £42,221 |
| **NPV — Market (8%)** | `SUM(PV repayments, 2026–2045)` | £24,088 |
| **NPV — ONS (Borrower Rate)** | `SUM(PV repayments, 2026–2045)` | £28,943 |
| **Face Value (2025 Balance)** | Closing loan balance at end of 2025 | £54,421 |
| **RAB Charge** | `(Face Value − HMT NPV) / Face Value` | **22.4%** |
| **% of Face Value (HMT)** | `HMT NPV / Face Value` | 77.6% |
| **% of Face Value (Market)** | `Market NPV / Face Value` | 44.3% |
| **% of Face Value (ONS)** | `ONS NPV / Face Value` | 53.2% |

---

## 8. Reference Data (Sheet2)

Contains historical look-up tables used to populate the model's time series:

- **Interest rate history** (2012/13–2024/25): Max rate, min rate, status (standard/capped)
- **Maintenance loan averages** by nation (England, Wales, NI, Scotland) from 2003–2025
- **Repayment & interest thresholds** history (2012–2027): lower threshold, upper threshold

---

## 9. Key Modelling Notes for Implementation

1. **Time axis**: Each column represents a **tax year ending** (e.g., column for "2025" = tax year ending April 2025). The model spans 2013–2060.
2. **Circular reference protection**: Mid-year balance (`Row 33`) is calculated as `previous_year_closing + new_borrowing/2`, avoiding a true circular reference.
3. **Write-off**: At exactly **30 years after graduation**, the balance drops to zero. The final year's repayment is still collected but interest is not added to the balance.
4. **Repayment cap in write-off year**: In the write-off year (AO/2046), the repayment formula changes slightly — it's capped at `mid-year_balance` only (not `mid-year_balance + interest`).
5. **Wage forecasting**: After actuals end (~2024), the AWE index is projected using a separate forecast series (Row 13), and thresholds grow proportionally with the AWE forecast ratio year-on-year.
6. **Interest rate from 2026+**: Low rate = 3% flat; High rate = 6% flat (3% + 3%). Before 2026, historical rates are used.
7. **All repayments are annual** — no monthly compounding.

---

## 10. Suggested Interactive Controls for Web App

| Control | Maps To | Type |
|---|---|---|
| Graduation year | `E24` | Dropdown / number input (2012–2030) |
| Starting salary | `K29` (or equivalent) | Slider / number input (£15k–£80k) |
| Tuition fees per year | Row 20 | Number input |
| Maintenance loan per year | Row 21 | Number input |
| Long-term RPI assumption | Row 6 (post-2026) | Slider (0%–5%) |
| Commercial discount rate | `E4` | Slider (2%–15%) |
| Repayment rate | Hardcoded at 9% | Slider (5%–15%) |
| Write-off period | Hardcoded at 30 years | Dropdown (20–40 years) |

**Outputs to display**: Loan balance over time (chart), total repaid, total interest, NPV under each method, RAB charge, year debt is cleared (if ever), and proportion written off.