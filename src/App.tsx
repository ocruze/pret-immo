import { Box, ColorSchemeScript, createTheme, MantineProvider, type MantineColorsTuple } from "@mantine/core";
import { Header } from "./components/Header/Header";
import LoanCapacity from "./components/LoanCapacity/LoanCapacity";

import "@mantine/core/styles.css";
import { Footer } from "./components/Footer/Footer";

const myColor: MantineColorsTuple = ["#eceaff", "#d4d1ff", "#a59ffe", "#736afa", "#3c2ff7", "#2e21f6", "#1f11f7", "#1006dd", "#0704c6", "#0000af"];

const theme = createTheme({
    colors: {
        myColor,
    },
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
