export type AmortizationRow = {
    month: number;
    capitalBefore: number;
    interest: number;
    amortization: number;
    installment: number;
    capitalAfter: number;
};

export type InsuranceBasis = "initial" | "remaining";

export const toMonthlyRate = (annualRatePercent: number): number => (annualRatePercent > 0 ? annualRatePercent / 100 / 12 : 0);

export const calculateLoanPrincipalWithSingleRate = (maxInstallment: number, annualRatePercent: number, totalMonths: number): number => {
    if (totalMonths <= 0 || maxInstallment <= 0) return 0;

    const monthlyRate = toMonthlyRate(annualRatePercent);
    if (monthlyRate === 0) return maxInstallment * totalMonths;

    const denominator = monthlyRate / (1 - Math.pow(1 + monthlyRate, -totalMonths));
    return maxInstallment / denominator;
};

export const calculateMonthlyInstallmentForPrincipal = (principal: number, annualRatePercent: number, totalMonths: number): number => {
    if (principal <= 0 || totalMonths <= 0) return 0;

    const monthlyRate = toMonthlyRate(annualRatePercent);
    if (monthlyRate === 0) return principal / totalMonths;

    const denominator = 1 - Math.pow(1 + monthlyRate, -totalMonths);
    return (principal * monthlyRate) / denominator;
};

export const calculateMaxPrincipalWithInsuranceRate = (
    monthlyBudget: number,
    annualLoanRatePercent: number,
    annualInsuranceRatePercent: number,
    totalMonths: number,
    insuranceBasis: InsuranceBasis = "initial"
): number => {
    if (monthlyBudget <= 0 || totalMonths <= 0) return 0;

    const insuranceMonthlyRate = toMonthlyRate(annualInsuranceRatePercent);

    if (insuranceMonthlyRate === 0) {
        return calculateLoanPrincipalWithSingleRate(monthlyBudget, annualLoanRatePercent, totalMonths);
    }

    // Unit-principal scaling: with constant-rate annuities, installment and remaining capital scale linearly with principal.
    // We compute the maximum monthly outflow for principal = 1, then scale.
    const unitPrincipal = 1;
    const unitInstallment = calculateMonthlyInstallmentForPrincipal(unitPrincipal, annualLoanRatePercent, totalMonths);
    if (unitInstallment <= 0) return 0;

    const monthlyRates = buildMonthlyRatesArray(annualLoanRatePercent, totalMonths);
    const amortizationTable = buildAmortizationTable(unitPrincipal, unitInstallment, monthlyRates, totalMonths);
    if (amortizationTable.length === 0) return 0;

    let unitMaxOutflow = 0;

    if (insuranceBasis === "initial") {
        unitMaxOutflow = unitInstallment + unitPrincipal * insuranceMonthlyRate;
    } else {
        for (const row of amortizationTable) {
            const insurance = row.capitalBefore * insuranceMonthlyRate;
            unitMaxOutflow = Math.max(unitMaxOutflow, unitInstallment + insurance);
        }
    }

    if (unitMaxOutflow <= 0) return 0;
    return monthlyBudget / unitMaxOutflow;
};

export const buildMonthlyRatesArray = (singleAnnualRatePercent: number, totalMonths: number): number[] => {
    const monthlyRate = toMonthlyRate(singleAnnualRatePercent);
    return Array.from({ length: Math.max(0, totalMonths) }, () => monthlyRate);
};

export const buildAmortizationTable = (principal: number, monthlyInstallment: number, monthlyRates: number[], totalMonths: number): AmortizationRow[] => {
    if (principal <= 0 || totalMonths <= 0) return [];

    const table: AmortizationRow[] = [];
    let remainingCapital = principal;

    for (let month = 1; month <= totalMonths; month++) {
        const capitalBefore = remainingCapital;
        const rate = monthlyRates[month - 1] || 0;
        const interest = capitalBefore * rate;
        const amortization = Math.min(Math.max(monthlyInstallment - interest, 0), capitalBefore);
        const installment = interest + amortization;
        const capitalAfter = capitalBefore - amortization;

        table.push({
            month,
            capitalBefore,
            interest,
            amortization,
            installment,
            capitalAfter,
        });

        remainingCapital = capitalAfter;
        if (amortization <= 0) break;
        if (remainingCapital <= 0) break;
    }

    return table;
};

export const calculateIrrMonthly = (cashflows: number[]): number | null => {
    if (cashflows.length < 2) return null;

    const npv = (rate: number): number => {
        if (rate <= -1) return Number.NaN;
        const step = 1 / (1 + rate);
        let discountFactor = 1;
        let sum = 0;

        for (let t = 0; t < cashflows.length; t++) {
            sum += cashflows[t] * discountFactor;
            discountFactor *= step;
        }

        return sum;
    };

    const maxIterations = 100;
    const tolerance = 1e-8;

    let low = 0;
    let high = 1;
    let fLow = npv(low);
    if (!Number.isFinite(fLow)) return null;
    if (Math.abs(fLow) < tolerance) return low;

    let fHigh = npv(high);
    if (!Number.isFinite(fHigh)) return null;

    while (fLow * fHigh > 0 && high < 100) {
        high *= 2;
        fHigh = npv(high);
        if (!Number.isFinite(fHigh)) return null;
    }

    if (fLow * fHigh > 0) return null;

    for (let i = 0; i < maxIterations; i++) {
        const mid = (low + high) / 2;
        const fMid = npv(mid);

        if (!Number.isFinite(fMid)) return null;
        if (Math.abs(fMid) < tolerance) return mid;

        if (fLow * fMid > 0) {
            low = mid;
            fLow = fMid;
        } else {
            high = mid;
            fHigh = fMid;
        }
    }

    return (low + high) / 2;
};
