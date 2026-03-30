import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@trendyol/baklava/dist/themes/default.css";
import "@trendyol/baklava/dist/baklava.js";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
