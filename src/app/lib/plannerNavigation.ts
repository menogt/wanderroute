import type { Screen } from "../components/rl/types";

export const PRIMARY_PLANNER_SCREEN: Screen = "planning-v2";
export const CLASSIC_PLANNER_SCREEN: Screen = "classic-planner";

const RESTORABLE_SCREENS: Screen[] = ["home", PRIMARY_PLANNER_SCREEN, CLASSIC_PLANNER_SCREEN,
  "routes", "hotels", "map"];

export function resolvePlannerScreen(screen: Screen): Screen {
  return screen === "planner" ? PRIMARY_PLANNER_SCREEN : screen;
}

export function restoreScreen(saved: string | null): Screen {
  const resolved = saved ? resolvePlannerScreen(saved as Screen) : "home";
  return RESTORABLE_SCREENS.includes(resolved) ? resolved : "home";
}

export function canRestoreScreen(screen: Screen): boolean {
  return RESTORABLE_SCREENS.includes(screen);
}
