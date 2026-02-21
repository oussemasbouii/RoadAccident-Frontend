import React from "react";
import ReactDOM from "react-dom/client";
import GlobalStyles from "@mui/material/GlobalStyles";
import { StyledEngineProvider } from "@mui/material/styles";
import App from "./App";
import "./index.css";
import { ThemeModeProvider } from "./themeMode";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <StyledEngineProvider enableCssLayer>
      <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
      <ThemeModeProvider>
        <App />
      </ThemeModeProvider>
    </StyledEngineProvider>
  </React.StrictMode>,
);
