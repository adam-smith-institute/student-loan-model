# UK Plan 2 Student Loan Model — Notes

## What the Model Does

This interactive simulator models the lifetime trajectory of a **English Plan 2 student loan** — the scheme covering graduates from 2012 to 2023. It allows users to adjust both the characteristics of a hypothetical borrower and the parameters of loan policy, then compares a "status quo" scenario against a user-defined "changed" scenario side by side.

The core output is a year-by-year simulation of loan balance, interest accrued, and repayments from the borrower's graduation through either full repayment or write-off. From these cash flows the model derives summary statistics including total repaid, total interest, and the year of payoff or write-off. It also produces **net present value (NPV) estimates** under three different discount rate conventions — Government/HMT, Market, and ONS/borrower rate — as well as the **RAB charge**, which represents the effective government subsidy expressed as a fraction of the loan's face value.

---

## Key Assumptions

### Income and Career Trajectory

The borrower is assumed to begin work in their graduation year at a user-specified starting salary. Income then grows each subsequent year through two compounding factors applied simultaneously. The first is an age-dependent real career growth rate derived from empirical earnings profiles: workers in their early twenties see strong real wage growth (around 2.4% per year for ages 22–29), which tapers to near zero in the thirties and turns mildly negative after forty, reaching around −1.3% per year for workers over fifty. The second factor is economy-wide nominal wage growth, proxied by the **Average Weekly Earnings (AWE)** index, which shifts all incomes in line with the broader labour market each year.

The model assumes the borrower is continuously and fully employed throughout their working life. There is no provision for unemployment spells, career breaks, part-time work, or early retirement.

### Macroeconomic Series

RPI inflation is taken from historical data through 2025, then assumed to run at approximately 3% per year through 2029 before settling at a long-run rate of **2.1% per year** from 2030 onward. The AWE series similarly uses historical data through the mid-2020s and then extrapolates forward at the most recently observed growth rate.

Repayment thresholds — both the lower threshold (below which no repayment is due) and the upper threshold (above which the maximum interest rate applies) — are taken from published government figures where known, and projected to grow in line with AWE once the published series runs out.

### Interest Rate Mechanics

While studying, the borrower is charged the **high interest rate**, which is RPI plus the high spread (3% by default). After graduation, the interest rate tapers linearly with income: borrowers earning at or below the lower threshold pay RPI plus the low spread (0% by default), while those at or above the upper threshold pay RPI plus the high spread. Borrowers with income between the two thresholds pay a proportionally interpolated rate.

During the period from 2021 to 2024, the government imposed a **Prevailing Market Rate (PMR) cap** on student loan interest. The model accounts for this by computing a weighted average of the capped rate (applied in months where the cap was binding) and the uncapped formula rate (applied in remaining months) within each affected tax year.

### Loan Balance Mechanics

The loan balance accumulates during study from annual tuition fees and maintenance loans (or, alternatively, can be entered directly as a known 2025 balance). After graduation, annual repayments are calculated as 9% of income above the lower threshold — the standard Plan 2 rate — subject to a cap that prevents repayments from exceeding the outstanding balance plus accrued interest in any given year. Any remaining balance is written off after the write-off period, which defaults to 30 years post-graduation.

### Valuations and Discount Rates

The model computes NPVs from 2026 onward under three discount rate conventions. The **Government/HMT** rate approximates the government's cost of borrowing: RPI minus 0.85 percentage points before 2030, transitioning to RPI plus 0.05 percentage points thereafter. The **Market** rate uses a fixed 6.8% per year, reflecting a private-sector opportunity cost. The **ONS/borrower** rate discounts at the borrower's own interest rate each year, which corresponds to the methodology used by the Office for National Statistics in its student loan valuations.

The **RAB charge** — the Resource Accounting and Budgeting charge — is derived from the HMT valuation as the share of the loan's face value that is not expected to be recovered in present value terms. A RAB charge of, say, 40% means the government expects to recover only 60 pence in present value for every pound lent.

---

## What the Model Does Not Capture

The model is deliberately simplified and is not intended as a precise predictor of individual outcomes. It does not model income volatility, unemployment, or part-time work; it does not account for tax interactions such as National Insurance or income tax; and it does not capture any behavioural responses to policy changes. It is a single-borrower model and does not aggregate across cohorts to produce fiscal cost estimates. The model covers Plan 2 only and does not apply to Plan 5 (post-2023 entrants) or other loan plans.