import type { GeneratedItinerary } from "./types";

const TRIPS_KEY = "wanderroute_saved_trips";
const CURRENT_KEY = "wanderroute_current_trip";
const MAX_TRIPS = 10;

// Save current trip to localStorage (called automatically on generation)
export function saveCurrentTrip(itinerary: GeneratedItinerary): void {
  try {
    // Always save as current trip
    localStorage.setItem(CURRENT_KEY, JSON.stringify(itinerary));

    // Also add to saved trips list
    const trips = getSavedTrips();

    // Don't duplicate — remove if same id exists
    const filtered = trips.filter(t => t.id !== itinerary.id);

    // Add to front of list
    filtered.unshift(itinerary);

    // Keep max 10
    const trimmed = filtered.slice(0, MAX_TRIPS);

    localStorage.setItem(TRIPS_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Could not save trip:", err);
  }
}

// Load the last active trip (restores state on page refresh)
export function loadCurrentTrip(): GeneratedItinerary | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Get all saved trips
export function getSavedTrips(): GeneratedItinerary[] {
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Delete a trip by id
export function deleteTrip(id: string): void {
  try {
    const trips = getSavedTrips().filter(t => t.id !== id);
    localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));

    // If deleted trip was the current one, clear current
    const current = loadCurrentTrip();
    if (current?.id === id) {
      localStorage.removeItem(CURRENT_KEY);
    }
  } catch (err) {
    console.warn("Could not delete trip:", err);
  }
}

// Clear all saved trips
export function clearAllTrips(): void {
  localStorage.removeItem(TRIPS_KEY);
  localStorage.removeItem(CURRENT_KEY);
}

// Format a saved date for display
export function formatSavedDate(id: string): string {
  // id format is "rl-{timestamp}"
  const ts = parseInt(id.replace("rl-", ""));
  if (isNaN(ts)) return "Recently";
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
