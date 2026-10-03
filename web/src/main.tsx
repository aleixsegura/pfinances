import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LanguageProvider } from "./i18n/LanguageContext";
import { loadSymbolConfig } from "./symbolConfig";
import "./index.css";

// Sectors and ticker aliases are read synchronously while rendering, so
// their (tiny, local) JSON file is loaded first.
void loadSymbolConfig().then(() =>
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
