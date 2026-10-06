import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { PublicSportId } from "./components/PublicSportId";

const publicMatch=window.location.pathname.match(/^\/id\/([A-Za-z0-9_-]{12,80})\/?$/);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      {publicMatch?<PublicSportId slug={publicMatch[1]!}/>:<App />}
    </AppErrorBoundary>
  </StrictMode>
);

// PWA: register the service worker in production only. The worker uses a
// conservative network-first strategy and never intercepts API/Firestore/
// storage traffic, so it cannot serve stale data.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", {updateViaCache:"none"}).catch(() => {
      /* SW unavailable (e.g. unsupported context) — app still works */
    });
  });
}
