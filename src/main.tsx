
  import { createRoot } from "react-dom/client";
  import { lazy, Suspense } from "react";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import "./app/components/rl/leafletSetup";

  import { loadPlanningDraft } from "./app/lib/planningDraft";
  const TripStudio = lazy(() => import("./app/components/tripStudio/TripStudio"));
  const isTripStudio = /^\/trip-studio\/?$/.test(window.location.pathname);
  const recoveredTrip = isTripStudio && window.location.search !== "?manual" ? loadPlanningDraft(localStorage) : undefined;
  createRoot(document.getElementById("root")!).render(isTripStudio && !recoveredTrip
    ? <Suspense fallback={<p role="status">Opening Trip Studio…</p>}><TripStudio /></Suspense>
    : <App openStudio={isTripStudio} recoveredTrip={recoveredTrip} />);
