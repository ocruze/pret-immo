import { IconInfoCircle } from "@tabler/icons-react";
import {
    Accordion,
    Anchor,
    Box,
    Button,
    Collapse,
    Container,
    Flex,
    Group,
    InputLabel,
    NumberInput,
    Radio,
    Slider,
    Table,
    Text,
    Title,
    UnstyledButton,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod/v4";
// Types
type AmortizationRow = {
    month: number;
    capitalBefore: number;
    interest: number;
    amortization: number;
    installment: number;
    capitalAfter: number;
};

type InputMode = "income" | "installment";
type InsuranceMode = "flat" | "rate";
type InsuranceBasis = "initial" | "remaining";
type GuaranteeType = "none" | "caution" | "mortgage";
type GuaranteePayment = "upfront" | "financed";

// Constants
const MAX_LOAN_DURATION_YEARS = 25;
const DEBT_TO_INCOME_RATIO = 1 / 3;
const DEFAULT_RATE = 3.8;
const DEFAULT_INSURANCE_RATE = 0.3;

const numberFromInput = (value: unknown): number | undefined => {
    if (value === "" || value === null || value === undefined) return undefined;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
};

const requiredPositiveNumber = (invalidTypeMessage: string, positiveMessage: string) =>
    z.preprocess(
        (value) => {
            const numeric = numberFromInput(value);
            return numeric === undefined ? NaN : numeric;
        },
        z.number({ message: invalidTypeMessage }).positive({ message: positiveMessage })
    );

const optionalPositiveNumber = (invalidTypeMessage: string, positiveMessage: string) =>
    z.preprocess((value) => numberFromInput(value), z.number({ message: invalidTypeMessage }).positive({ message: positiveMessage }).optional());

const requiredNumberMin = (invalidTypeMessage: string, minValue: number, minMessage: string) =>
    z.preprocess(
        (value) => {
            const numeric = numberFromInput(value);
            return numeric === undefined ? NaN : numeric;
        },
        z.number({ message: invalidTypeMessage }).min(minValue, { message: minMessage })
    );

const optionalNumberMinDefault0 = (invalidTypeMessage: string, minValue: number, minMessage: string) =>
    z.preprocess(
        (value) => {
            const numeric = numberFromInput(value);
            return numeric === undefined ? 0 : numeric;
        },
        z.number({ message: invalidTypeMessage }).min(minValue, { message: minMessage })
    );

const requiredIntNumberInRange = (invalidTypeMessage: string, minValue: number, maxValue: number, rangeMessage: string) =>
    z.preprocess(
        (value) => {
            const numeric = numberFromInput(value);
            return numeric === undefined ? NaN : numeric;
        },
        z
            .number({ message: invalidTypeMessage })
            .int({ message: invalidTypeMessage })
            .min(minValue, { message: rangeMessage })
            .max(maxValue, { message: rangeMessage })
    );

const loanCapacitySchema = z
    .object({
        inputMode: z.enum(["income", "installment"], { message: "Veuillez choisir une méthode de saisie" }),
        monthlyIncome: optionalPositiveNumber("Le revenu mensuel doit être un nombre", "Le revenu mensuel doit être supérieur à 0"),
        maxMonthlyInstallment: requiredPositiveNumber("La mensualité maximale doit être un nombre", "La mensualité maximale doit être supérieure à 0"),
        insuranceMode: z.enum(["flat", "rate"], { message: "Veuillez choisir un mode d’assurance" }),
        insuranceMonthly: optionalNumberMinDefault0("L’assurance mensuelle doit être un nombre", 0, "L’assurance mensuelle ne peut pas être négative"),
        insuranceRateAnnual: optionalNumberMinDefault0("Le taux d’assurance doit être un nombre", 0, "Le taux d’assurance ne peut pas être négatif"),
        insuranceBasis: z.enum(["initial", "remaining"], { message: "Veuillez choisir une base de calcul" }),
        guaranteeType: z.enum(["none", "caution", "mortgage"], { message: "Veuillez choisir un type de garantie" }),
        guaranteeFee: optionalNumberMinDefault0("Les frais de garantie doivent être un nombre", 0, "Les frais de garantie ne peuvent pas être négatifs"),
        guaranteePayment: z.enum(["upfront", "financed"], { message: "Veuillez choisir un mode de paiement" }),
        interestRate: requiredNumberMin("Le taux d’intérêt doit être un nombre", 0, "Le taux d’intérêt ne peut pas être négatif"),
        durationYears: requiredIntNumberInRange(
            "La durée doit être un nombre",
            1,
            MAX_LOAN_DURATION_YEARS,
            `La durée doit être comprise entre 1 et ${MAX_LOAN_DURATION_YEARS} ans`
        ),
    })
    .superRefine((values, ctx) => {
        if (values.inputMode === "income" && values.monthlyIncome === undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["monthlyIncome"],
                message: "Le revenu mensuel est requis dans ce mode",
            });
        }

        if (values.insuranceMode === "rate" && values.insuranceRateAnnual <= 0) {
            ctx.addIssue({
                code: "custom",
                path: ["insuranceRateAnnual"],
                message: "Le taux d’assurance est requis dans ce mode",
            });
        }

        if (values.guaranteeType !== "none" && values.guaranteeFee <= 0) {
            ctx.addIssue({
                code: "custom",
                path: ["guaranteeFee"],
                message: "Veuillez renseigner les frais de garantie",
            });
        }
    });

// Utility functions
const toMonthlyRate = (annualRate: number): number => (annualRate > 0 ? annualRate / 100 / 12 : 0);

const formatCurrency = (value: number): string =>
    new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

// Calculation functions
const calculateMaxMonthlyInstallment = (monthlyIncome: number): number => (monthlyIncome > 0 ? monthlyIncome * DEBT_TO_INCOME_RATIO : 0);

const calculateLoanPrincipalWithSingleRate = (maxInstallment: number, annualRate: number, totalMonths: number): number => {
    if (totalMonths <= 0 || maxInstallment <= 0) return 0;

    const monthlyRate = toMonthlyRate(annualRate);

    if (monthlyRate === 0) {
        return maxInstallment * totalMonths;
    }

    const denominator = monthlyRate / (1 - Math.pow(1 + monthlyRate, -totalMonths));
    return maxInstallment / denominator;
};

const calculateMonthlyInstallmentForPrincipal = (principal: number, annualRate: number, totalMonths: number): number => {
    if (principal <= 0 || totalMonths <= 0) return 0;

    const monthlyRate = toMonthlyRate(annualRate);
    if (monthlyRate === 0) return principal / totalMonths;

    const denominator = 1 - Math.pow(1 + monthlyRate, -totalMonths);
    return (principal * monthlyRate) / denominator;
};

const calculateMaxPrincipalWithInsuranceRate = (monthlyBudget: number, annualLoanRate: number, annualInsuranceRate: number, totalMonths: number): number => {
    if (monthlyBudget <= 0 || totalMonths <= 0) return 0;

    const insuranceMonthlyRate = toMonthlyRate(annualInsuranceRate);

    // If insurance is 0%, fall back to the standard formula.
    if (insuranceMonthlyRate === 0) {
        return calculateLoanPrincipalWithSingleRate(monthlyBudget, annualLoanRate, totalMonths);
    }

    // Upper bound: principal without insurance (will overrun budget when insurance is added).
    let high = calculateLoanPrincipalWithSingleRate(monthlyBudget, annualLoanRate, totalMonths);
    if (high <= 0) return 0;

    const totalMonthlyOutflow = (principal: number): number =>
        calculateMonthlyInstallmentForPrincipal(principal, annualLoanRate, totalMonths) + principal * insuranceMonthlyRate;

    // Ensure we bracket the solution.
    while (totalMonthlyOutflow(high) < monthlyBudget && high < 1e9) {
        high *= 2;
    }

    let low = 0;
    for (let i = 0; i < 80; i++) {
        const mid = (low + high) / 2;
        if (totalMonthlyOutflow(mid) > monthlyBudget) {
            high = mid;
        } else {
            low = mid;
        }
    }

    return low;
};

const buildMonthlyRatesArray = (singleRate: number, totalMonths: number): number[] => {
    const monthlyRates: number[] = [];
    const rate = toMonthlyRate(singleRate);
    monthlyRates.length = totalMonths;
    monthlyRates.fill(rate);
    return monthlyRates;
};

const buildAmortizationTable = (maxLoanPrincipal: number, maxInstallment: number, monthlyRates: number[], totalMonths: number): AmortizationRow[] => {
    if (maxLoanPrincipal <= 0 || totalMonths <= 0) return [];

    const table: AmortizationRow[] = [];
    let remainingCapital = maxLoanPrincipal;

    for (let month = 1; month <= totalMonths; month++) {
        const capitalBefore = remainingCapital;
        const rate = monthlyRates[month - 1] || 0;
        const interest = capitalBefore * rate;
        const amortization = Math.min(Math.max(maxInstallment - interest, 0), capitalBefore);
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

const calculateIrrMonthly = (cashflows: number[]): number | null => {
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

    // Expand high until we bracket a root or hit a limit.
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

const formatPercent = (value: number): string =>
    new Intl.NumberFormat("fr-FR", {
        style: "percent",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

export default function LoanCapacity() {
    const [insuranceHelpOpen, setInsuranceHelpOpen] = useState(false);
    const [guaranteeHelpOpen, setGuaranteeHelpOpen] = useState(false);

    const form = useForm({
        mode: "controlled",
        initialValues: {
            inputMode: "income" as InputMode,
            monthlyIncome: 2600,
            maxMonthlyInstallment: calculateMaxMonthlyInstallment(2600),
            insuranceMode: "flat" as InsuranceMode,
            insuranceMonthly: 0,
            insuranceRateAnnual: DEFAULT_INSURANCE_RATE,
            insuranceBasis: "initial" as InsuranceBasis,
            guaranteeType: "none" as GuaranteeType,
            guaranteeFee: 0,
            guaranteePayment: "upfront" as GuaranteePayment,
            interestRate: DEFAULT_RATE,
            durationYears: 25,
        },
        validate: zod4Resolver(loanCapacitySchema),
    });

    const { values, setFieldValue } = form;

    // Parse numeric values explicitly since TextInput/Slider can still store strings in form state.
    const inputMode = values.inputMode;
    const maxMonthlyInstallment = Number(values.maxMonthlyInstallment) || 0;
    const insuranceMode = values.insuranceMode;
    const insuranceMonthly = Number(values.insuranceMonthly) || 0;
    const insuranceRateAnnual = Number(values.insuranceRateAnnual) || 0;
    const insuranceBasis = values.insuranceBasis;
    const guaranteeType = values.guaranteeType;
    const guaranteeFee = Number(values.guaranteeFee) || 0;
    const guaranteePayment = values.guaranteePayment;
    const interestRate = Number(values.interestRate) || 0;
    const durationYears = Number(values.durationYears) || 0;

    useEffect(() => {
        if (inputMode !== "income") return;

        const income = Number(values.monthlyIncome);
        if (!Number.isFinite(income) || income <= 0) return;

        const derivedInstallment = calculateMaxMonthlyInstallment(income);
        const currentInstallment = Number(values.maxMonthlyInstallment);

        if (!Number.isFinite(currentInstallment) || Math.abs(currentInstallment - derivedInstallment) > 0.01) {
            setFieldValue("maxMonthlyInstallment", derivedInstallment);
        }
    }, [inputMode, setFieldValue, values.monthlyIncome, values.maxMonthlyInstallment]);

    // Derived state
    const totalMonths = durationYears * 12;

    const maxLoanPrincipal = useMemo(() => {
        if (maxMonthlyInstallment <= 0) return 0;

        if (insuranceMode === "rate") {
            return calculateMaxPrincipalWithInsuranceRate(maxMonthlyInstallment, interestRate, insuranceRateAnnual, totalMonths);
        }

        const creditMonthlyInstallment = Math.max(maxMonthlyInstallment - insuranceMonthly, 0);
        if (creditMonthlyInstallment <= 0) return 0;
        return calculateLoanPrincipalWithSingleRate(creditMonthlyInstallment, interestRate, totalMonths);
    }, [maxMonthlyInstallment, insuranceMode, insuranceMonthly, insuranceRateAnnual, interestRate, totalMonths]);

    const creditMonthlyInstallment = useMemo(() => {
        if (totalMonths <= 0 || maxLoanPrincipal <= 0) return 0;

        if (insuranceMode === "rate") {
            return calculateMonthlyInstallmentForPrincipal(maxLoanPrincipal, interestRate, totalMonths);
        }

        return Math.max(maxMonthlyInstallment - insuranceMonthly, 0);
    }, [insuranceMode, maxLoanPrincipal, interestRate, totalMonths, maxMonthlyInstallment, insuranceMonthly]);

    const monthlyRates = useMemo(() => buildMonthlyRatesArray(interestRate, totalMonths), [interestRate, totalMonths]);

    const amortizationTable = useMemo(
        () => buildAmortizationTable(maxLoanPrincipal, creditMonthlyInstallment, monthlyRates, totalMonths),
        [maxLoanPrincipal, creditMonthlyInstallment, monthlyRates, totalMonths]
    );

    const guaranteeFeeApplied = useMemo(() => (guaranteeType === "none" ? 0 : guaranteeFee), [guaranteeType, guaranteeFee]);

    const netProjectAmount = useMemo(() => {
        if (maxLoanPrincipal <= 0) return 0;
        return Math.max(maxLoanPrincipal - (guaranteePayment === "financed" ? guaranteeFeeApplied : 0), 0);
    }, [maxLoanPrincipal, guaranteePayment, guaranteeFeeApplied]);

    const insurancePerMonth = useMemo(() => {
        const months = amortizationTable.length;
        if (months === 0) return [] as number[];

        if (insuranceMode === "flat") {
            return Array.from({ length: months }, () => insuranceMonthly);
        }

        const monthlyInsuranceRate = toMonthlyRate(insuranceRateAnnual);
        if (monthlyInsuranceRate <= 0) {
            return Array.from({ length: months }, () => 0);
        }

        if (insuranceBasis === "remaining") {
            return amortizationTable.map((row) => row.capitalBefore * monthlyInsuranceRate);
        }

        const monthlyInsurance = maxLoanPrincipal * monthlyInsuranceRate;
        return Array.from({ length: months }, () => monthlyInsurance);
    }, [amortizationTable, insuranceMode, insuranceMonthly, insuranceRateAnnual, insuranceBasis, maxLoanPrincipal]);

    const totals = useMemo(() => {
        const totalCreditRepaid = amortizationTable.reduce((sum, row) => sum + row.installment, 0);
        const totalInterest = amortizationTable.reduce((sum, row) => sum + row.interest, 0);
        const totalPrincipalRepaid = amortizationTable.reduce((sum, row) => sum + row.amortization, 0);
        const totalInsurance = insurancePerMonth.reduce((sum, value) => sum + value, 0);
        const totalRepaid = totalCreditRepaid + totalInsurance;
        const totalCost = totalInterest + totalInsurance;
        const totalCostIncludingFees = totalCost + guaranteeFeeApplied;
        const totalPaidIncludingFees = totalRepaid + (guaranteePayment === "upfront" ? guaranteeFeeApplied : 0);

        return {
            months: amortizationTable.length,
            totalCreditRepaid,
            totalRepaid,
            totalInterest,
            totalPrincipalRepaid,
            totalInsurance,
            totalCost,
            totalCostIncludingFees,
            totalPaidIncludingFees,
        };
    }, [amortizationTable, insurancePerMonth, guaranteeFeeApplied, guaranteePayment]);

    const annualEffectiveRate = useMemo(() => {
        if (maxLoanPrincipal <= 0 || amortizationTable.length === 0) return null;

        const netAtStart = maxLoanPrincipal - guaranteeFeeApplied;
        const cashflows = [netAtStart, ...amortizationTable.map((row, index) => -(row.installment + (insurancePerMonth[index] || 0)))];
        const irrMonthly = calculateIrrMonthly(cashflows);
        if (irrMonthly === null) return null;

        return Math.pow(1 + irrMonthly, 12) - 1;
    }, [maxLoanPrincipal, amortizationTable, insurancePerMonth, guaranteeFeeApplied]);

    const annualEffectiveRateWithoutInsurance = useMemo(() => {
        if (maxLoanPrincipal <= 0 || amortizationTable.length === 0) return null;

        const netAtStart = maxLoanPrincipal - guaranteeFeeApplied;
        const cashflows = [netAtStart, ...amortizationTable.map((row) => -row.installment)];
        const irrMonthly = calculateIrrMonthly(cashflows);
        if (irrMonthly === null) return null;

        return Math.pow(1 + irrMonthly, 12) - 1;
    }, [maxLoanPrincipal, amortizationTable, guaranteeFeeApplied]);

    return (
        <Container size={"md"}>
            <Flex direction={"column"} gap="2rem" align={"center"}>
                <Title order={1} ta={"center"} my="lg">
                    Calculer votre capacité d’emprunt
                </Title>

                <Box w={{ base: "100%", sm: "90%", md: 600 }} px={{ base: "md", sm: 0 }}>
                    <form onSubmit={form.onSubmit((values) => console.log(values))}>
                        <Flex direction={"column"} gap="1.5rem">
                            <Radio.Group
                                withAsterisk
                                label="Budget mensuel"
                                description="Budget mensuel total = mensualité de crédit + assurance emprunteur."
                                key={form.key("inputMode")}
                                {...form.getInputProps("inputMode")}
                            >
                                <Group mt={8}>
                                    <Radio
                                        value="income"
                                        label="Mon revenu mensuel"
                                        description="Mensualité maximale calculée automatiquement (1/3 du revenu)."
                                    />
                                    <Radio value="installment" label="Ma mensualité maximale" description="Mensualité maximale saisie manuellement." />
                                </Group>
                            </Radio.Group>

                            <Group align="flex-start" justify="flex-start" grow>
                                {inputMode === "income" && (
                                    <NumberInput withAsterisk label="Revenu mensuel" key={form.key("monthlyIncome")} {...form.getInputProps("monthlyIncome")} />
                                )}

                                <NumberInput
                                    withAsterisk
                                    label="Mensualité maximale"
                                    key={form.key("maxMonthlyInstallment")}
                                    disabled={inputMode === "income"}
                                    {...form.getInputProps("maxMonthlyInstallment")}
                                />
                            </Group>

                            <Box>
                                <Radio.Group label="Assurance emprunteur" key={form.key("insuranceMode")} {...form.getInputProps("insuranceMode")}>
                                    <Group mt={8}>
                                        <Radio value="flat" label="Prime mensuelle (€ / mois)" description="Montant exact payé chaque mois." />
                                        <Radio value="rate" label="Taux d’assurance (% / an)" description="Taux appliqué au capital (selon contrat)." />
                                    </Group>
                                </Radio.Group>

                                <Text size="sm" c="dimmed" mt={6}>
                                    Choisissez l’option selon l’information dont vous disposez (montant ou taux).
                                </Text>

                                <UnstyledButton onClick={() => setInsuranceHelpOpen((v) => !v)}>
                                    <Text component="span" size="sm" c="dimmed" style={{ textDecoration: "underline" }}>
                                        <IconInfoCircle size={"14px"} /> Comment choisir ?
                                    </Text>
                                </UnstyledButton>

                                <Collapse in={insuranceHelpOpen}>
                                    <Box mt={6}>
                                        <Text size="sm">
                                            <strong>Prime mensuelle</strong> : si vous connaissez un montant en €/mois (devis/contrat).
                                        </Text>
                                        <Text size="sm" mt={4}>
                                            <strong>Taux annuel</strong> : si vous connaissez un taux en %/an (ex: 0,30%/an). Base « capital initial » = prime
                                            plutôt constante ; base « capital restant dû » = prime décroissante.
                                        </Text>
                                        <Text size="sm" mt={4}>
                                            <Anchor href="https://www.service-public.gouv.fr/particuliers/vosdroits/F1671" target="_blank" rel="noreferrer">
                                                En savoir plus sur l’assurance emprunteur (service-public.gouv.fr)
                                            </Anchor>
                                        </Text>
                                    </Box>
                                </Collapse>

                                {insuranceMode === "flat" ? (
                                    <NumberInput
                                        mt={8}
                                        label="Prime mensuelle (€/mois)"
                                        description="Montant fixe ajouté chaque mois (en plus de la mensualité de crédit)."
                                        placeholder="0"
                                        min={0}
                                        key={form.key("insuranceMonthly")}
                                        {...form.getInputProps("insuranceMonthly")}
                                    />
                                ) : (
                                    <Flex direction={{ base: "column", sm: "row" }} gap={"md"} mt={8}>
                                        <NumberInput
                                            withAsterisk
                                            label="Taux d’assurance (% / an)"
                                            description="Ex: 0,30 = 0,30%/an (pas 30%)."
                                            placeholder="0.30"
                                            min={0}
                                            step={0.05}
                                            key={form.key("insuranceRateAnnual")}
                                            {...form.getInputProps("insuranceRateAnnual")}
                                        />

                                        <Radio.Group label="Base" key={form.key("insuranceBasis")} {...form.getInputProps("insuranceBasis")}>
                                            <Group mt={8}>
                                                <Radio value="initial" label="Capital initial" description="Prime plutôt constante." />
                                                <Radio value="remaining" label="Capital restant dû" description="Prime décroissante." />
                                            </Group>
                                        </Radio.Group>
                                    </Flex>
                                )}

                                <Text size="xs" c="dimmed" mt={6}>
                                    L’assurance est incluse dans la mensualité totale et dans le TAEG.
                                </Text>
                            </Box>

                            <Box>
                                <Radio.Group label="Garantie" key={form.key("guaranteeType")} {...form.getInputProps("guaranteeType")}>
                                    <Group mt={8}>
                                        <Radio value="none" label="Aucune" description="Pas de frais de garantie modélisés." />
                                        <Radio value="caution" label="Caution" description="Garantie via un organisme de cautionnement." />
                                        <Radio value="mortgage" label="Hypothèque / PPD" description="Sûreté réelle sur le bien (frais associés)." />
                                    </Group>
                                </Radio.Group>

                                <Text size="sm" c="dimmed" mt={6}>
                                    La garantie protège la banque. Les frais associés peuvent impacter le TAEG.
                                </Text>

                                <UnstyledButton onClick={() => setGuaranteeHelpOpen((v) => !v)}>
                                    <Text component="span" size="sm" c="dimmed" style={{ textDecoration: "underline" }}>
                                        <IconInfoCircle size={"14px"} /> Comment choisir ?
                                    </Text>
                                </UnstyledButton>

                                <Collapse in={guaranteeHelpOpen}>
                                    <Box mt={6}>
                                        <Text size="sm">
                                            <strong>Caution</strong> : garantie via un organisme ; coût et modalités selon dossier/organisme.
                                        </Text>
                                        <Text size="sm" mt={4}>
                                            <strong>Hypothèque / PPD</strong> : sûreté réelle sur le bien (frais/inscription, formalités).
                                        </Text>
                                        <Text size="sm" mt={4}>
                                            <Anchor
                                                href="https://www.lafinancepourtous.com/pratique/credit/credit-immobilier/pret-immo-l-essentiel-a-savoir/les-garanties/"
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                En savoir plus sur les garanties (lafinancepourtous.com)
                                            </Anchor>
                                        </Text>
                                    </Box>
                                </Collapse>

                                {guaranteeType !== "none" && (
                                    <Flex direction={{ base: "column", sm: "row" }} gap={"md"} mt={8}>
                                        <NumberInput
                                            label="Frais de garantie (€)"
                                            description="Estimation des frais liés à la garantie (impacte le TAEG)."
                                            placeholder="0"
                                            min={0}
                                            key={form.key("guaranteeFee")}
                                            {...form.getInputProps("guaranteeFee")}
                                        />

                                        <Radio.Group label="Paiement" key={form.key("guaranteePayment")} {...form.getInputProps("guaranteePayment")}>
                                            <Group mt={8}>
                                                <Radio value="upfront" label="Payés comptant" description="Payés au départ." />
                                                <Radio value="financed" label="Financés" description="Déduits du montant débloqué." />
                                            </Group>
                                        </Radio.Group>
                                    </Flex>
                                )}

                                <Text size="xs" c="dimmed" mt={6}>
                                    Les frais de garantie sont inclus dans le TAEG (paiement au départ).
                                </Text>
                            </Box>

                            <Flex direction="column" w="100%">
                                <InputLabel size="sm">Durée (années)</InputLabel>
                                <Slider
                                    defaultValue={25}
                                    restrictToMarks
                                    min={1}
                                    max={25}
                                    marks={[5, 10, 15, 20, 25].map((v) => ({ value: v, label: v }))}
                                    key={form.key("durationYears")}
                                    {...form.getInputProps("durationYears")}
                                />
                                <Text size="sm" c="dimmed" mt={"lg"}>
                                    Plus la durée est longue, plus la mensualité baisse, mais le coût total augmente.
                                </Text>
                            </Flex>

                            <Box>
                                <NumberInput
                                    withAsterisk
                                    label="Taux d’intérêt (%)"
                                    description={
                                        <Text component="span" style={{ display: "block" }} size="sm" c="dimmed">
                                            Taux nominal annuel du prêt (hors assurance). Le TAEG inclut aussi l’assurance et les frais.{" "}
                                            <Anchor href="https://www.service-public.gouv.fr/particuliers/vosdroits/F2456" target="_blank" rel="noreferrer">
                                                En savoir plus
                                            </Anchor>
                                        </Text>
                                    }
                                    placeholder="3.8"
                                    key={form.key("interestRate")}
                                    step={0.1}
                                    {...form.getInputProps("interestRate")}
                                />
                            </Box>

                            <Group justify="flex-end" mt="md">
                                <Button type="submit">Valider</Button>
                            </Group>
                        </Flex>
                    </form>
                </Box>

                {maxLoanPrincipal > 0 && (
                    <Box w={{ base: "100%", sm: "90%" }} px={{ base: "md", sm: 0 }}>
                        <h2>Résultats</h2>
                        <p>
                            <strong>Mensualité totale maximale (budget) :</strong> {formatCurrency(maxMonthlyInstallment)}
                        </p>
                        <p>
                            <strong>Assurance mensuelle :</strong>{" "}
                            {insurancePerMonth.length === 0
                                ? formatCurrency(0)
                                : insuranceBasis === "remaining" && insuranceMode === "rate"
                                  ? `${formatCurrency(insurancePerMonth[0] || 0)} (mois 1, puis décroissante)`
                                  : formatCurrency(insurancePerMonth[0] || 0)}
                        </p>
                        <p>
                            <strong>Mensualité crédit (hors assurance) :</strong> {formatCurrency(creditMonthlyInstallment)}
                        </p>
                        <p>
                            <strong>Capacité d’emprunt maximale :</strong> {formatCurrency(maxLoanPrincipal)}
                        </p>
                        {guaranteeType !== "none" && guaranteePayment === "upfront" && (
                            <p>
                                <strong>Frais de garantie à payer au départ :</strong> {formatCurrency(guaranteeFeeApplied)}
                            </p>
                        )}
                        {guaranteeType !== "none" && guaranteePayment === "financed" && (
                            <p>
                                <strong>Montant disponible (après frais financés) :</strong> {formatCurrency(netProjectAmount)}
                            </p>
                        )}
                        <p>
                            <strong>Total remboursé (crédit + assurance) :</strong> {formatCurrency(totals.totalRepaid)}
                        </p>
                        {guaranteeType !== "none" && (
                            <p>
                                <strong>Total payé (crédit + assurance + frais) :</strong> {formatCurrency(totals.totalPaidIncludingFees)}
                            </p>
                        )}
                        <p>
                            <strong>Coût du crédit (intérêts) :</strong> {formatCurrency(totals.totalInterest)}
                        </p>
                        <p>
                            <strong>Coût de l’assurance :</strong> {formatCurrency(totals.totalInsurance)}
                        </p>
                        <p>
                            <strong>Coût total (intérêts + assurance) :</strong> {formatCurrency(totals.totalCost)}
                        </p>
                        {guaranteeType !== "none" && (
                            <p>
                                <strong>Coût total (intérêts + assurance + frais) :</strong> {formatCurrency(totals.totalCostIncludingFees)}
                            </p>
                        )}
                        <p>
                            <strong>TAEG (avec assurance) :</strong> {annualEffectiveRate === null ? "—" : formatPercent(annualEffectiveRate)}
                        </p>
                        <p>
                            <strong>TAEG (hors assurance) :</strong>{" "}
                            {annualEffectiveRateWithoutInsurance === null ? "—" : formatPercent(annualEffectiveRateWithoutInsurance)}
                        </p>

                        <Accordion>
                            <Accordion.Item value="amortization" mt={16}>
                                <Accordion.Control p={0}>
                                    <strong>Tableau d’amortissement :</strong>
                                </Accordion.Control>
                                <Accordion.Panel>
                                    <Table.ScrollContainer minWidth={500}>
                                        <Table striped highlightOnHover withTableBorder withColumnBorders w={"100%"}>
                                            <Table.Thead>
                                                <Table.Tr>
                                                    <Table.Th>Mois</Table.Th>
                                                    <Table.Th>Capital initial</Table.Th>
                                                    <Table.Th>Intérêts</Table.Th>
                                                    <Table.Th>Amortissement</Table.Th>
                                                    <Table.Th>Mensualité (crédit)</Table.Th>
                                                    <Table.Th>Assurance</Table.Th>
                                                    <Table.Th>Total</Table.Th>
                                                    <Table.Th>Capital restant dû</Table.Th>
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {amortizationTable.map((row) => (
                                                    <Table.Tr key={row.month}>
                                                        <Table.Td align="right">{row.month}</Table.Td>
                                                        <Table.Td align="right">{formatCurrency(row.capitalBefore)}</Table.Td>
                                                        <Table.Td align="right">{formatCurrency(row.interest)}</Table.Td>
                                                        <Table.Td align="right">{formatCurrency(row.amortization)}</Table.Td>
                                                        <Table.Td align="right">{formatCurrency(row.installment)}</Table.Td>
                                                        <Table.Td align="right">{formatCurrency(insurancePerMonth[row.month - 1] || 0)}</Table.Td>
                                                        <Table.Td align="right">
                                                            {formatCurrency(row.installment + (insurancePerMonth[row.month - 1] || 0))}
                                                        </Table.Td>
                                                        <Table.Td align="right">{formatCurrency(row.capitalAfter)}</Table.Td>
                                                    </Table.Tr>
                                                ))}
                                            </Table.Tbody>
                                        </Table>
                                    </Table.ScrollContainer>
                                </Accordion.Panel>
                            </Accordion.Item>
                        </Accordion>
                    </Box>
                )}
            </Flex>
        </Container>
    );
}
