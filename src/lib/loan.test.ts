import { describe, expect, it } from "vitest";

import {
    buildAmortizationTable,
    buildMonthlyRatesArray,
    calculateIrrMonthly,
    calculateLoanPrincipalWithSingleRate,
    calculateMaxPrincipalWithInsuranceRate,
    calculateMonthlyInstallmentForPrincipal,
    toMonthlyRate,
} from "./loan";

describe("loan math", () => {
    it("toMonthlyRate converts annual percent to monthly rate", () => {
        expect(toMonthlyRate(12)).toBeCloseTo(0.01, 12);
        expect(toMonthlyRate(0)).toBe(0);
        expect(toMonthlyRate(-5)).toBe(0);
    });

    it("principal formula handles zero interest", () => {
        const principal = calculateLoanPrincipalWithSingleRate(1000, 0, 24);
        expect(principal).toBeCloseTo(24000, 10);
    });

    it("installment and principal are consistent (inverse-ish)", () => {
        const principal = 200_000;
        const annualRate = 3.6;
        const months = 240;

        const installment = calculateMonthlyInstallmentForPrincipal(principal, annualRate, months);
        const principal2 = calculateLoanPrincipalWithSingleRate(installment, annualRate, months);

        expect(principal2 / principal).toBeCloseTo(1, 8);
    });

    it("amortization table decreases capital and ends near zero", () => {
        const principal = 100_000;
        const annualRate = 3;
        const months = 120;
        const installment = calculateMonthlyInstallmentForPrincipal(principal, annualRate, months);
        const monthlyRates = buildMonthlyRatesArray(annualRate, months);

        const table = buildAmortizationTable(principal, installment, monthlyRates, months);
        expect(table.length).toBeGreaterThan(0);
        expect(table.length).toBeLessThanOrEqual(months);

        for (let i = 1; i < table.length; i++) {
            expect(table[i]!.capitalAfter).toBeLessThanOrEqual(table[i - 1]!.capitalAfter + 1e-9);
        }

        const last = table[table.length - 1]!;
        expect(last.capitalAfter).toBeLessThanOrEqual(1e-4);
    });

    it("IRR solves a simple two-period case", () => {
        const irr = calculateIrrMonthly([1000, -1100]);
        expect(irr).not.toBeNull();
        expect(irr!).toBeCloseTo(0.1, 10);
    });

    it("max principal with insurance rate falls back when insurance is 0%", () => {
        const budget = 1200;
        const loanRate = 3.8;
        const months = 25 * 12;

        const a = calculateMaxPrincipalWithInsuranceRate(budget, loanRate, 0, months, "initial");
        const b = calculateLoanPrincipalWithSingleRate(budget, loanRate, months);
        expect(a).toBeCloseTo(b, 8);
    });

    it("max principal with insurance rate is monotonic in budget", () => {
        const p1 = calculateMaxPrincipalWithInsuranceRate(800, 3.8, 0.3, 300, "initial");
        const p2 = calculateMaxPrincipalWithInsuranceRate(1200, 3.8, 0.3, 300, "initial");
        expect(p2).toBeGreaterThan(p1);
    });

    it("insurance basis remaining matches initial under this model (peak month is month 1)", () => {
        const budget = 1200;
        const loanRate = 3.8;
        const insRate = 0.3;
        const months = 25 * 12;

        const pInitial = calculateMaxPrincipalWithInsuranceRate(budget, loanRate, insRate, months, "initial");
        const pRemaining = calculateMaxPrincipalWithInsuranceRate(budget, loanRate, insRate, months, "remaining");
        expect(pRemaining).toBeCloseTo(pInitial, 10);
    });

    it("closed-form check when loan rate is 0%", () => {
        const budget = 1000;
        const months = 240;
        const insMonthlyRate = toMonthlyRate(0.3);

        // With loanRate=0, monthly installment is P/months, insurance peak is P*insMonthlyRate.
        // Budget constraint: P*(1/months + insMonthlyRate) <= budget.
        const expected = budget / (1 / months + insMonthlyRate);
        const actual = calculateMaxPrincipalWithInsuranceRate(budget, 0, 0.3, months, "initial");

        expect(actual).toBeCloseTo(expected, 8);
    });
});
