To validate the reasoning of a student loan valuation model for **Plan 2**, an AI should check the model against the following logic parameters derived from the DfE methodology and statutory guidance.

### 1. Eligibility & Loan Term
*   **Cohort Definition:** The model should apply Plan 2 rules only to English undergraduate/PGCE borrowers who started their course between **1 September 2012** and **31 July 2023**.
*   **Loan Term (Write-off):** The outstanding balance must be written off **30 years** after the Statutory Repayment Due Date (SRDD).
*   **SRDD Definition:** The April following the completion of or withdrawal from the course.

### 2. Repayment Logic (Cash Flow)
The model must calculate the annual repayment flow using the following conditional logic:
*   **Threshold:** For FY 2023-24 and 2024-25, the repayment threshold is **£27,295**. From April 2025, it rises to **£28,470**.
*   **Rate:** Repayments are **9%** of gross income above the threshold.
*   **Formula:** `Repayment = MAX(0, (Income - Threshold) * 0.09)`.

### 3. Interest Rate Logic (Accrual)
Plan 2 interest is variable and income-contingent. The model must apply interest *before* deducting repayments.

**A. Status Check**
*   **In-Study:** If the borrower is studying (or prior to SRDD), the interest rate is **RPI + 3%**.
*   **Post-SRDD:** The rate relies on a sliding scale based on income.

**B. The Sliding Scale (Post-SRDD)**
*   **Lower Threshold:** £27,295 (for FY 24/25).
*   **Upper Threshold:** £49,130 (for FY 24/25).
*   **Calculation:**
    *   `Income <= Lower Threshold`: Interest = **RPI**.
    *   `Income >= Upper Threshold`: Interest = **RPI + 3%**.
    *   `Between Thresholds`: Interest = $RPI + 3\% \times \left( \frac{\text{Income} - \text{Lower}}{\text{Upper} - \text{Lower}} \right)$.

**C. Prevailing Market Rate (PMR) Cap**
*   **Constraint:** The model must check if the calculated rate exceeds the commercial market cap.
*   **Logic:** `Final_Interest = MIN(Calculated_Rate, PMR_Cap)`.
*   **Historical Caps for Validation:**
    *   Sept 2023 – Nov 2023: **7.3%**.
    *   Dec 2023: **7.5%**.
    *   Jan 2024 – Feb 2024: **7.6%**.
    *   Mar 2024: **7.7%**.
    *   *Note:* Caps were lifted in September 2024 as RPI fell to 4.3%.

### 4. Valuation Logic (Discounting)
If the model calculates the **RAB Charge** or **Stock Charge**, it must use the specific government discount rates rather than a commercial rate.

*   **Discount Rate:**
    *   **Until 2029-30:** RPI - 0.85%.
    *   **From 2030-31:** RPI + 0.05%.
*   **Method:** Calculate the Net Present Value (NPV) of the projected repayments using the split discount rate above.
*   **RAB Calculation:** `(Total Outlay - NPV of Repayments) / Total Outlay`.

### 5. Modelling Frictions (Advanced Checks)
A robust model should not assume 100% of theoretical repayments are collected. It should check for "frictions":
*   **Volatility:** Does the model account for income fluctuations (e.g., periods of unemployment)? The DfE uses stochastic modelling for this rather than linear growth.
*   **Employment Status:** The model should account for borrowers moving in and out of the UK tax system (e.g., migration), where collection rates may differ.