
  import { createRoot } from "react-dom/client";
  import { lazy, Suspense } from "react";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import "./app/components/rl/leafletSetup";

  const TripStudio = lazy(() => import("./app/components/tripStudio/TripStudio"));
  const isTripStudio = /^\/trip-studio\/?$/.test(window.location.pathname);
  createRoot(document.getElementById("root")!).render(isTripStudio
    ? <Suspense fallback={<p role="status">Opening Trip Studio…</p>}><TripStudio /></Suspense>
    : <App />);
