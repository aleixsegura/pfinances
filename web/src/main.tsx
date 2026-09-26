import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LanguageProvider } from "./i18n/LanguageContext";
import { loadSymbolConfig } from "./symbolConfig";
import { loadGoalDefaults } from "./useGoalSettings";
import "./index.css";

// Sectors, ticker aliases and goal defaults are read synchronously while
// rendering, so their (tiny, local) JSON files are loaded first.
void Promise.all([loadSymbolConfig(), loadGoalDefaults()]).then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </BrowserRouter>
    </StrictMode>,
  ),
);
