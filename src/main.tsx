import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { StoreProvider } from "./state/store";
import { registerSW } from "./lib/push";
import "./styles.css";

// modo mock (npm run dev:mock) — eliminado do bundle de produção
if (import.meta.env.DEV && import.meta.env.MODE === "mock") {
  await import("./dev/mock");
}

registerSW();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>
);
