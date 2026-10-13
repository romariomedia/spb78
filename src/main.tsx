import { NativeVkReturn } from './components/NativeVkReturn';
import { nativeVkReturnIntent } from './services/nativeVk';
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { PublicSportId } from "./components/PublicSportId";

const vkReturn = !Capacitor.isNativePlatform() && window.location.pathname.replace(/\/$/, '') === '/vk-callback'
  ? nativeVkReturnIntent(new URL(window.location.href)) : '';
if (vkReturn) window.history.replaceState({}, document.title, '/vk-callback');
const publicMatch=window.location.hash.match(/^#\/id\/([A-Za-z0-9_-]{12,80})\/?$/);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      {vkReturn?<NativeVkReturn intentUrl={vkReturn}/>:publicMatch?<PublicSportId slug={publicMatch[1]!}/>:<App />}
    </AppErrorBoundary>
  </StrictMode>
);

// PWA: register the service worker in production only. The worker uses a
// conservative network-first strategy and never intercepts API/Firestore/
// storage traffic, so it cannot serve stale data.
if (Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  // The APK owns its bundled assets; the website service worker must not cache them.
  void navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => {});
}
if (import.meta.env.PROD && !Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", {updateViaCache:"none"}).catch(() => {
      /* SW unavailable (e.g. unsupported context) — app still works */
    });
  });
}
