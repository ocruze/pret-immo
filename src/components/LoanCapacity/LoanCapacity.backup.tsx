import { Accordion, Button, Group, NumberInput, Radio, Table, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useEffect, useState } from "react";

export default function LoanCapacity() {
    const form = useForm({
        mode: "controlled",
        initialValues: {
            monthlyIncome: 3200,
            interestRate: 3.8,
            durationYears: 25,
            ratePeriods: [] as Array<{ years: number; rate: number }>,
        },
        validate: {
            monthlyIncome: (value) =>
                isNaN(value) || !value ? "Le revenu mensuel doit être un nombre" : value <= 0 ? "Le revenu mensuel doit être supérieur à 0" : null,
            interestRate: (value) =>
                isNaN(value) || !value ? "Le taux d'intérêt doit être un nombre" : value < 0 ? "Le taux d'intérêt ne peut pas être négatif" : null,
            durationYears: (value) =>
                isNaN(value) || !value ? "La durée doit être un nombre" : value <= 0 || value > 25 ? "La durée doit être comprise entre 1 et 25 ans" : null,
            ratePeriods: (list: Array<{ years: number; rate: number }>) => {
                if (!Array.isArray(list) || list.length === 0) return null; // optional
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

    const [rateMode, setRateMode] = useState<"single" | "multi">("single");

    // Derived calculations
    const { monthlyIncome, interestRate, durationYears, ratePeriods } = form.getValues();
    const maxMonthlyInstallment = monthlyIncome > 0 ? monthlyIncome / 3 : 0;
    let maxLoanPrincipal = 0;
    const totalMonths = durationYears * 12;
    const periodsActive = Array.isArray(ratePeriods) && ratePeriods.length > 0;
    const usePeriods = rateMode === "multi" && periodsActive;
    const periodsYearsTotal = usePeriods ? ratePeriods.reduce((s, p) => s + (Number(p.years) || 0), 0) : 0;
    const periodsMismatch = usePeriods && periodsYearsTotal !== durationYears;

    if (maxMonthlyInstallment > 0) {
        if (usePeriods && !periodsMismatch) {
            // Present value with varying rates: PV = payment * sum DF_t
            let pvFactorSum = 0;
            let discountFactor = 1; // DF_0
            let monthsCount = 0;
            for (const period of ratePeriods) {
                const months = (Number(period.years) || 0) * 12;
                const rMonthly = Number(period.rate) > 0 ? Number(period.rate) / 100 / 12 : 0;
                for (let m = 0; m < months; m++) {
                    if (monthsCount >= totalMonths) break;
                    discountFactor = discountFactor * (1 / (1 + rMonthly));
                    pvFactorSum += discountFactor;
                    monthsCount += 1;
                }
                if (monthsCount >= totalMonths) break;
            }
            maxLoanPrincipal = maxMonthlyInstallment * pvFactorSum;
        } else {
            const monthlyRate = interestRate > 0 ? interestRate / 100 / 12 : 0;
            if (totalMonths > 0) {
                if (monthlyRate === 0) {
                    maxLoanPrincipal = maxMonthlyInstallment * totalMonths;
                } else {
                    const denom = monthlyRate / (1 - Math.pow(1 + monthlyRate, -totalMonths));
                    maxLoanPrincipal = maxMonthlyInstallment / denom;
                }
            }
        }
    }

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

    // Build amortization table (tableau d'amortissement)
    type AmortizationRow = {
        month: number;
        capitalBefore: number;
        interest: number;
        amortization: number;
        installment: number;
        capitalAfter: number;
    };

    const buildAmortizationTable = (): AmortizationRow[] => {
        if (maxLoanPrincipal <= 0 || totalMonths <= 0) return [];

        const table: AmortizationRow[] = [];
        let remainingCapital = maxLoanPrincipal;

        // Build a month-to-rate map based on mode
        const monthlyRates: number[] = [];
        if (usePeriods && !periodsMismatch) {
            let monthIdx = 0;
            for (const period of ratePeriods) {
                const months = (Number(period.years) || 0) * 12;
                const rate = Number(period.rate) > 0 ? Number(period.rate) / 100 / 12 : 0;
                for (let m = 0; m < months; m++) {
                    if (monthIdx >= totalMonths) break;
                    monthlyRates.push(rate);
                    monthIdx++;
                }
                if (monthIdx >= totalMonths) break;
            }
        } else {
            const rate = interestRate > 0 ? interestRate / 100 / 12 : 0;
            for (let m = 0; m < totalMonths; m++) {
                monthlyRates.push(rate);
            }
        }

        for (let month = 1; month <= totalMonths; month++) {
            const capitalBefore = remainingCapital;
            const rate = monthlyRates[month - 1] || 0;
            const interest = capitalBefore * rate;
            const amortization = maxMonthlyInstallment - interest;
            const capitalAfter = Math.max(capitalBefore - amortization, 0);

            table.push({
                month,
                capitalBefore,
                interest,
                amortization,
                installment: maxMonthlyInstallment,
                capitalAfter,
            });

            remainingCapital = capitalAfter;
            if (remainingCapital <= 0) break;
        }

        return table;
    };

    const amortizationTable = buildAmortizationTable();

    // Auto-fill behavior: ensure the last period's years equals remaining years
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

    return (
        <>
            <h1>Calculer votre capacité d'emprunt</h1>

            <form onSubmit={form.onSubmit((values) => console.log(values))}>
                <TextInput withAsterisk label="Revenu mensuel" placeholder="3000" key={form.key("monthlyIncome")} {...form.getInputProps("monthlyIncome")} />

                <TextInput withAsterisk label="Durée (années)" placeholder="15" key={form.key("durationYears")} {...form.getInputProps("durationYears")} />
                <div style={{ marginTop: 16 }}>
                    <Radio.Group value={rateMode} onChange={(v) => setRateMode(v as "single" | "multi")} mb={8}>
                        <Group gap="md">
                            <Radio value="single" label="Taux unique" />
                            <Radio value="multi" label="Périodes multiples" />
                        </Group>
                    </Radio.Group>

                    {rateMode === "multi" ? (
                        <>
                            <Group justify="space-between" mb={8}>
                                <Text size="sm">Périodes de taux (optionnel)</Text>
                                <Button
                                    variant="light"
                                    size="xs"
                                    onClick={() => {
                                        const list = form.values.ratePeriods || [];
                                        const used = list.reduce((s: number, p: { years: number }) => s + (Number(p.years) || 0), 0);
                                        const remaining = Math.max(Number(form.values.durationYears) - used, 0);
                                        form.insertListItem("ratePeriods", { years: remaining || 1, rate: 2 });
                                    }}
                                >
                                    Ajouter une période
                                </Button>
                            </Group>

                            {form.values.ratePeriods?.map((_, idx) => (
                                <Group key={idx} align="flex-end" mb={8} grow>
                                    <NumberInput
                                        label="Années"
                                        min={1}
                                        step={1}
                                        allowDecimal={false}
                                        disabled={idx === (form.values.ratePeriods?.length || 1) - 1}
                                        key={form.key(`ratePeriods.${idx}.years`)}
                                        {...form.getInputProps(`ratePeriods.${idx}.years`)}
                                    />
                                    <NumberInput
                                        label="Taux (%)"
                                        min={0}
                                        step={0.1}
                                        decimalScale={2}
                                        key={form.key(`ratePeriods.${idx}.rate`)}
                                        {...form.getInputProps(`ratePeriods.${idx}.rate`)}
                                    />
                                    <Button color="red" variant="subtle" onClick={() => form.removeListItem("ratePeriods", idx)}>
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

            <div style={{ marginTop: 24 }}>
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
                            {ratePeriods.map((p: { years: number; rate: number }, i: number) => (
                                <li key={i}>
                                    {p.years} ans @ {p.rate}%
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {maxLoanPrincipal > 0 && (
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
                )}
            </div>
        </>
    );
}
