import { Anchor, Container, Flex, Group, Text } from "@mantine/core";

import { links } from "../../links";
import classes from "./Footer.module.css";

export function Footer() {
    const items = links.map((link) => (
        <Anchor<"a"> c="dimmed" key={link.label} href={link.link} onClick={(event) => event.preventDefault()} size="sm">
            {link.label}
        </Anchor>
    ));

    return (
        <div className={classes.footer}>
            <Container className={classes.inner}>
                <Flex
                    direction={{
                        base: "column",
                        sm: "row",
                    }}
                    justify={"space-between"}
                    align="center"
                    gap={{ base: "1rem", sm: "6rem" }}
                    w={"100%"}
                >
                    <span>Prêt immo</span>
                    <Text
                        size="sm"
                        c="dimmed"
                        w={{
                            base: "100%",
                            sm: "400px",
                        }}
                        ta={"center"}
                    >
                        Petite application (un peu vibe codée) pour calculer la capacité d'emprunt immobilier. A but éducatif uniquement, ne pas utiliser pour
                        des demandes réelles.
                    </Text>
                    <Group className={classes.links}>{items}</Group>
                </Flex>
            </Container>
        </div>
    );
}
