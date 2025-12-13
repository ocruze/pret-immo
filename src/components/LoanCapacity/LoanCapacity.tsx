import { Accordion, Box, Button, Container, Flex, Group, NumberInput, Radio, Slider, Table, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useEffect, useMemo, useState } from "react";

// Types
type RatePeriod = { years: number; rate: number };

type AmortizationRow = {
    month: number;
    capitalBefore: number;
    interest: number;
    amortization: number;
    installment: number;
    capitalAfter: number;
};

type RateMode = "single" | "multi";

// Constants
const MAX_LOAN_DURATION_YEARS = 25;
const DEBT_TO_INCOME_RATIO = 1 / 3;
const DEFAULT_RATE = 3.8;

// Utility functions
const toMonthlyRate = (annualRate: number): number => (annualRate > 0 ? annualRate / 100 / 12 : 0);

const formatCurrency = (value: number): string =>
    new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

const sumPeriodYears = (periods: RatePeriod[]): number => periods.reduce((sum, p) => sum + (Number(p.years) || 0), 0);

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

const calculateLoanPrincipalWithMultipleRates = (maxInstallment: number, periods: RatePeriod[], totalMonths: number): number => {
    if (totalMonths <= 0 || maxInstallment <= 0 || periods.length === 0) return 0;

    let pvFactorSum = 0;
    let discountFactor = 1;
    let monthsCount = 0;

    for (const period of periods) {
        const months = (Number(period.years) || 0) * 12;
        const monthlyRate = toMonthlyRate(Number(period.rate));

        for (let m = 0; m < months; m++) {
            if (monthsCount >= totalMonths) break;
            discountFactor = discountFactor / (1 + monthlyRate);
            pvFactorSum += discountFactor;
            monthsCount++;
        }

        if (monthsCount >= totalMonths) break;
    }

    return maxInstallment * pvFactorSum;
};

const buildMonthlyRatesArray = (rateMode: RateMode, periods: RatePeriod[], singleRate: number, totalMonths: number): number[] => {
    const monthlyRates: number[] = [];

    if (rateMode === "multi") {
        let monthIdx = 0;
        for (const period of periods) {
            const months = (Number(period.years) || 0) * 12;
            const rate = toMonthlyRate(Number(period.rate));

            for (let m = 0; m < months && monthIdx < totalMonths; m++) {
                monthlyRates.push(rate);
                monthIdx++;
            }

            if (monthIdx >= totalMonths) break;
        }
    } else {
        const rate = toMonthlyRate(singleRate);
        monthlyRates.length = totalMonths;
        monthlyRates.fill(rate);
    }

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
        const amortization = maxInstallment - interest;
        const capitalAfter = Math.max(capitalBefore - amortization, 0);

        table.push({
            month,
            capitalBefore,
            interest,
            amortization,
            installment: maxInstallment,
            capitalAfter,
        });

        remainingCapital = capitalAfter;
        if (remainingCapital <= 0) break;
    }

    return table;
};

// Component
export default function LoanCapacity() {
    const [rateMode, setRateMode] = useState<RateMode>("single");

    const form = useForm({
        mode: "controlled",
        initialValues: {
            monthlyIncome: 2600,
            interestRate: DEFAULT_RATE,
            durationYears: 20,
            ratePeriods: [] as RatePeriod[],
        },
        validate: {
            monthlyIncome: (value) =>
                isNaN(value) || !value ? "Le revenu mensuel doit être un nombre" : value <= 0 ? "Le revenu mensuel doit être supérieur à 0" : null,
            interestRate: (value) =>
                isNaN(value) || !value ? "Le taux d'intérêt doit être un nombre" : value < 0 ? "Le taux d'intérêt ne peut pas être négatif" : null,
            durationYears: (value) =>
                isNaN(value) || !value
                    ? "La durée doit être un nombre"
                    : value <= 0 || value > MAX_LOAN_DURATION_YEARS
                    ? `La durée doit être comprise entre 1 et ${MAX_LOAN_DURATION_YEARS} ans`
                    : null,
            ratePeriods: (list: RatePeriod[]) => {
                if (!Array.isArray(list) || list.length === 0) return null;
                if (list.some((p) => !isFinite(Number(p.years)) || Number(p.years) <= 0)) return "Chaque période doit avoir des années > 0";
                if (list.some((p) => !isFinite(Number(p.rate)) || Number(p.rate) < 0)) return "Les taux ne peuvent pas être négatifs";
                return null;
            },
        },
        transformValues: (values) => ({
            ...values,
            monthlyIncome: Number(values.monthlyIncome),
            interestRate: Number(values.interestRate),
            durationYears: Number(values.durationYears),
            ratePeriods: Array.isArray(values.ratePeriods) ? values.ratePeriods.map((p) => ({ years: Number(p.years), rate: Number(p.rate) })) : [],
        }),
    });

    const { monthlyIncome, interestRate, durationYears, ratePeriods } = form.getValues();

    // Derived state
    const totalMonths = durationYears * 12;
    const periodsActive = Array.isArray(ratePeriods) && ratePeriods.length > 0;
    const usePeriods = rateMode === "multi" && periodsActive;
    const periodsYearsTotal = usePeriods ? sumPeriodYears(ratePeriods) : 0;
    const periodsMismatch = usePeriods && periodsYearsTotal !== durationYears;

    // Calculations
    const maxMonthlyInstallment = useMemo(() => calculateMaxMonthlyInstallment(monthlyIncome), [monthlyIncome]);

    const maxLoanPrincipal = useMemo(() => {
        if (maxMonthlyInstallment <= 0) return 0;

        if (usePeriods && !periodsMismatch) {
            return calculateLoanPrincipalWithMultipleRates(maxMonthlyInstallment, ratePeriods, totalMonths);
        }

        return calculateLoanPrincipalWithSingleRate(maxMonthlyInstallment, interestRate, totalMonths);
    }, [maxMonthlyInstallment, usePeriods, periodsMismatch, ratePeriods, totalMonths, interestRate]);

    const monthlyRates = useMemo(
        () => buildMonthlyRatesArray(usePeriods && !periodsMismatch ? "multi" : "single", ratePeriods, interestRate, totalMonths),
        [usePeriods, periodsMismatch, ratePeriods, interestRate, totalMonths]
    );

    const amortizationTable = useMemo(
        () => buildAmortizationTable(maxLoanPrincipal, maxMonthlyInstallment, monthlyRates, totalMonths),
        [maxLoanPrincipal, maxMonthlyInstallment, monthlyRates, totalMonths]
    );

    // Auto-fill last period's years to match loan duration
    useEffect(() => {
        if (rateMode !== "multi") return;

        const list = form.values.ratePeriods;
        const duration = Number(form.values.durationYears) || 0;

        if (!Array.isArray(list) || list.length === 0 || duration <= 0) return;

        const lastIndex = list.length - 1;
        const sumExceptLast = list.slice(0, lastIndex).reduce((s, p) => s + (Number(p.years) || 0), 0);
        const targetLastYears = Math.max(duration - sumExceptLast, 0);
        const currentLastYears = Number(list[lastIndex]?.years) || 0;

        if (currentLastYears !== targetLastYears) {
            form.setFieldValue(`ratePeriods.${lastIndex}.years`, targetLastYears);
        }
    }, [form, form.values.ratePeriods, form.values.durationYears, rateMode]);

    // Event handlers
    const handleAddPeriod = () => {
        const list = form.values.ratePeriods || [];
        const used = sumPeriodYears(list);
        const remaining = Math.max(Number(form.values.durationYears) - used, 0);
        form.insertListItem("ratePeriods", { years: remaining || 1, rate: DEFAULT_RATE });
    };

    const handleRemovePeriod = (index: number) => {
        form.removeListItem("ratePeriods", index);
    };

    return (
        <Container size={"md"}>
            <Flex direction={"column"} gap="2rem" align={"center"}>
                <h1>Calculer votre capacité d'emprunt</h1>
                <Box w={"600"}>
                    <form onSubmit={form.onSubmit((values) => console.log(values))}>
                        <Group justify="flex-start" mb={8} grow>
                            <TextInput
                                withAsterisk
                                label="Revenu mensuel"
                                placeholder="3000"
                                key={form.key("monthlyIncome")}
                                {...form.getInputProps("monthlyIncome")}
                            />

                            {/* <TextInput
                                withAsterisk
                                label="Durée (années)"
                                placeholder="15"
                                key={form.key("durationYears")}
                                {...form.getInputProps("durationYears")}
                            /> */}

                            <Flex direction="column" w="100%">
                                <Text size="sm">Durée (années)</Text>
                                <Slider
                                    label="Durée du prêt (années)"
                                    defaultValue={25}
                                    restrictToMarks
                                    min={0}
                                    max={25}
                                    marks={[5, 10, 15, 20, 25].map((v) => ({ value: v, label: v }))}
                                    key={form.key("durationYears")}
                                    {...form.getInputProps("durationYears")}
                                />
                            </Flex>
                        </Group>

                        <div style={{ marginTop: 16 }}>
                            <Radio.Group value={rateMode} onChange={(v) => setRateMode(v as RateMode)} mb={8}>
                                <Group gap="md">
                                    <Radio value="single" label="Taux unique" />
                                    <Radio value="multi" label="Périodes multiples" />
                                </Group>
                            </Radio.Group>

                            {rateMode === "multi" ? (
                                <>
                                    <Group justify="space-between" mb={8}>
                                        <Text size="sm">Périodes de taux</Text>
                                        <Button variant="light" size="xs" onClick={handleAddPeriod}>
                                            Ajouter une période
                                        </Button>
                                    </Group>

                                    {form.values.ratePeriods?.map((_, i) => (
                                        <Group key={i} align="flex-end" mb={8} grow>
                                            <NumberInput
                                                label="Années"
                                                min={1}
                                                step={1}
                                                allowDecimal={false}
                                                disabled={i === (form.values.ratePeriods?.length || 1) - 1}
                                                key={form.key(`ratePeriods.${i}.years`)}
                                                {...form.getInputProps(`ratePeriods.${i}.years`)}
                                            />
                                            <NumberInput
                                                label="Taux (%)"
                                                min={0}
                                                step={0.1}
                                                decimalScale={2}
                                                key={form.key(`ratePeriods.${i}.rate`)}
                                                {...form.getInputProps(`ratePeriods.${i}.rate`)}
                                            />
                                            <Button color="red" variant="light" onClick={() => handleRemovePeriod(i)}>
                                                Supprimer
                                            </Button>
                                        </Group>
                                    ))}

                                    {periodsActive && (
                                        <Text size="sm" c={periodsMismatch ? "red" : "dimmed"}>
                                            Total des années des périodes: {periodsYearsTotal} / Durée du prêt: {durationYears}
                                            {periodsMismatch ? " — Ajustez pour que la somme corresponde à la durée." : ""}
                                        </Text>
                                    )}
                                </>
                            ) : (
                                <TextInput
                                    withAsterisk
                                    label="Taux d'intérêt (%)"
                                    placeholder="3.8"
                                    key={form.key("interestRate")}
                                    {...form.getInputProps("interestRate")}
                                />
                            )}
                        </div>

                        <Group justify="flex-end" mt="md">
                            <Button type="submit">Valider</Button>
                        </Group>
                    </form>
                </Box>

                {maxLoanPrincipal > 0 && (
                    <Box w={"600"}>
                        <h2>Résultats</h2>
                        <p>
                            <strong>Mensualité maximale :</strong> {formatCurrency(maxMonthlyInstallment)}
                        </p>
                        <p>
                            <strong>Capacité d'emprunt maximale :</strong> {formatCurrency(maxLoanPrincipal)}
                        </p>

                        {usePeriods && !periodsMismatch && (
                            <div>
                                <Text size="sm" c="dimmed">
                                    Périodes utilisées :
                                </Text>
                                <ul>
                                    {ratePeriods.map((p, i) => (
                                        <li key={i}>
                                            {p.years} ans @ {p.rate}%
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <Accordion>
                            <Accordion.Item value="amortization" mt={16}>
                                <Accordion.Control p={0}>
                                    <strong>Tableau d'amortissement :</strong>
                                </Accordion.Control>
                                <Accordion.Panel>
                                    <Table striped highlightOnHover withTableBorder withColumnBorders>
                                        <Table.Thead>
                                            <Table.Tr>
                                                <Table.Th>Mois</Table.Th>
                                                <Table.Th>Capital initial</Table.Th>
                                                <Table.Th>Intérêts</Table.Th>
                                                <Table.Th>Amortissement</Table.Th>
                                                <Table.Th>Mensualité</Table.Th>
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
                                                    <Table.Td align="right">{formatCurrency(row.capitalAfter)}</Table.Td>
                                                </Table.Tr>
                                            ))}
                                        </Table.Tbody>
                                    </Table>
                                </Accordion.Panel>
                            </Accordion.Item>
                        </Accordion>
                    </Box>
                )}
            </Flex>
        </Container>
    );
}
