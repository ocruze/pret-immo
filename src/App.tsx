import { Box, ColorSchemeScript, createTheme, MantineProvider, type MantineColorsTuple } from "@mantine/core";

import { Footer } from "./components/Footer/Footer";
import { Header } from "./components/Header/Header";
import LoanCapacity from "./components/LoanCapacity/LoanCapacity";

import "@mantine/core/styles.css";

const myColor: MantineColorsTuple = ["#e5f3ff", "#cde2ff", "#9ac2ff", "#64a0ff", "#3884fe", "#1d72fe", "#0063ff", "#0058e4", "#004ecd", "#0043b5"];

const theme = createTheme({
    colors: {
        myColor,
    },
    primaryColor: "myColor",
});

function App() {
    return (
        <>
            <ColorSchemeScript forceColorScheme="light" />
            <MantineProvider theme={theme} defaultColorScheme="light" forceColorScheme="light">
                <Header />
                <Box mih="calc(100vh - 200px)">
                    <LoanCapacity />
                </Box>
                <Footer />
            </MantineProvider>
        </>
    );
}

export default App;
