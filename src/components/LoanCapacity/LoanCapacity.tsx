import { Accordion, Box, Button, Container, Flex, Group, InputLabel, NumberInput, Radio, Slider, Table, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { useEffect, useMemo } from "react";
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

// Constants
const MAX_LOAN_DURATION_YEARS = 25;
const DEBT_TO_INCOME_RATIO = 1 / 3;
const DEFAULT_RATE = 3.8;

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
        interestRate: requiredNumberMin("Le taux d'intérêt doit être un nombre", 0, "Le taux d'intérêt ne peut pas être négatif"),
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

export default function LoanCapacity() {
    const form = useForm({
        mode: "controlled",
        initialValues: {
            inputMode: "income" as InputMode,
            monthlyIncome: 2600,
            maxMonthlyInstallment: calculateMaxMonthlyInstallment(2600),
            interestRate: DEFAULT_RATE,
            durationYears: 20,
        },
        validate: zod4Resolver(loanCapacitySchema),
    });

    const { values, setFieldValue } = form;

    // Parse numeric values explicitly since TextInput/Slider can still store strings in form state.
    const inputMode = values.inputMode;
    const maxMonthlyInstallment = Number(values.maxMonthlyInstallment) || 0;
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

    // Calculations
    const maxLoanPrincipal = useMemo(() => {
        if (maxMonthlyInstallment <= 0) return 0;
        return calculateLoanPrincipalWithSingleRate(maxMonthlyInstallment, interestRate, totalMonths);
    }, [maxMonthlyInstallment, totalMonths, interestRate]);

    const monthlyRates = useMemo(() => buildMonthlyRatesArray(interestRate, totalMonths), [interestRate, totalMonths]);

    const amortizationTable = useMemo(
        () => buildAmortizationTable(maxLoanPrincipal, maxMonthlyInstallment, monthlyRates, totalMonths),
        [maxLoanPrincipal, maxMonthlyInstallment, monthlyRates, totalMonths]
    );

    return (
        <Container size={"md"}>
            <Flex direction={"column"} gap="2rem" align={"center"}>
                <Title order={1} ta={"center"} my="lg">
                    Calculer votre capacité d'emprunt
                </Title>

                <Box w={{ base: "100%", sm: "90%", md: 600 }} px={{ base: "md", sm: 0 }}>
                    <form onSubmit={form.onSubmit((values) => console.log(values))}>
                        <Flex direction={"column"} gap="1.5rem">
                            <Radio.Group withAsterisk label="Je renseigne" key={form.key("inputMode")} {...form.getInputProps("inputMode")}>
                                <Group mt={8}>
                                    <Radio value="income" label="Mon revenu mensuel" />
                                    <Radio value="installment" label="Ma mensualité maximale" />
                                </Group>
                            </Radio.Group>

                            <Group align="flex-start" justify="flex-start" grow>
                                {inputMode === "income" && (
                                    <NumberInput
                                        withAsterisk
                                        label="Revenu mensuel"
                                        placeholder="3000"
                                        key={form.key("monthlyIncome")}
                                        {...form.getInputProps("monthlyIncome")}
                                    />
                                )}

                                <NumberInput
                                    withAsterisk
                                    label="Mensualité maximale"
                                    placeholder="1000"
                                    key={form.key("maxMonthlyInstallment")}
                                    disabled={inputMode === "income"}
                                    {...form.getInputProps("maxMonthlyInstallment")}
                                />
                            </Group>

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
                            </Flex>

                            <Box>
                                <NumberInput
                                    withAsterisk
                                    label="Taux d'intérêt (%)"
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
                    <Box w={{ base: "100%", sm: "90%", md: 600 }} px={{ base: "md", sm: 0 }}>
                        <h2>Résultats</h2>
                        <p>
                            <strong>Mensualité maximale :</strong> {formatCurrency(maxMonthlyInstallment)}
                        </p>
                        <p>
                            <strong>Capacité d'emprunt maximale :</strong> {formatCurrency(maxLoanPrincipal)}
                        </p>

                        <Accordion>
                            <Accordion.Item value="amortization" mt={16}>
                                <Accordion.Control p={0}>
                                    <strong>Tableau d'amortissement :</strong>
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
