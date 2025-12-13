import { Burger, Container, Flex, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useState } from "react";

import { links } from "../../links";
import classes from "./Header.module.css";

export function Header() {
    const [opened, { toggle }] = useDisclosure(false);
    const [active, setActive] = useState(links[0].link);

    const items = links.map((link) => (
        <a
            key={link.label}
            href={link.link}
            className={classes.link}
            data-active={active === link.link || undefined}
            onClick={(event) => {
                event.preventDefault();
                setActive(link.link);
            }}
        >
            {link.label}
        </a>
    ));

    return (
        <header className={classes.header}>
            <Container size="md" className={classes.inner}>
                <Flex justify={"space-between"} align="center" gap="6rem" w={"100%"}>
                    <span>Prêt immo</span>
                    <Group gap={5} visibleFrom="xs">
                        {items}
                    </Group>
                    <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" />
                </Flex>
            </Container>
        </header>
    );
}
