import { Burger, Button, Collapse, Container, Flex, Group, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCashBanknote } from "@tabler/icons-react";
import { useState } from "react";

import { links } from "../../links";

import classes from "./Header.module.css";

export function Header() {
    const [opened, { toggle }] = useDisclosure(false);
    const [active, setActive] = useState<(typeof links)[number]["link"]>(links[0].link);

    const items = links.map((link) => (
        <Button
            key={link.label}
            component="a"
            href={link.link}
            // className={classes.link}
            variant={active === link.link ? "filled" : "subtle"}
            data-active={active === link.link || undefined}
            onClick={() => {
                setActive(link.link);
            }}
        >
            {link.label}
        </Button>
    ));

    return (
        <header className={classes.header}>
            <Container size="md" className={classes.inner}>
                <Flex justify={"space-between"} align="center" gap={{ base: "1rem", sm: "6rem" }} w={"100%"}>
                    <Flex component="span" gap={"xs"}>
                        <IconCashBanknote stroke={2} /> Prêt immo
                    </Flex>
                    <Group gap={5} visibleFrom="xs">
                        {items}
                    </Group>
                    <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" />
                </Flex>
                <Collapse in={opened} hiddenFrom="xs">
                    <Stack gap={8} mt={12} pb={12}>
                        {items}
                    </Stack>
                </Collapse>
            </Container>
        </header>
    );
}
