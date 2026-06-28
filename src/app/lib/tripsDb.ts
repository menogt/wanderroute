import { supabase, type DbTrip } from "./supabase";
import type { GeneratedItinerary } from "../components/rl/types";
import {
  saveCurrentTrip as localSave,
  getSavedTrips as localGet,
  deleteTrip as localDelete,
  loadCurrentTrip as localLoadCurrent,
} from "../components/rl/tripStorage";
import { getDeviceId } from "./placesDb";

// Save to localStorage instantly, then sync to Supabase
export async function saveTrip(itinerary: GeneratedItinerary): Promise<void> {
  localSave(itinerary);
  if (!supabase) return;

  const row: DbTrip = {
    id: itinerary.id,
    route_name: itinerary.routeName,
    route_slogan: itinerary.routeSlogan,
    cities: itinerary.cities,
    total_days: itinerary.totalDays,
    total_people: itinerary.totalPeople,
    currency: itinerary.currency,
    estimated_total_cost: itinerary.estimatedTotalCost,
    estimated_cost_per_person: itinerary.estimatedCostPerPerson,
    input_budget: itinerary.inputBudget,
    remaining_budget: itinerary.remainingBudget,
    budget_status: itinerary.budgetStatus,
    travel_style: itinerary.travelStyle,
    itinerary_json: itinerary as unknown as object,
    device_id: getDeviceId(),
  };

  const { error } = await supabase
    .from("trips")
    .upsert(row, { onConflict: "id" });

  if (error) {
    console.warn("Supabase trip sync failed (saved locally):", error.message);
  }
}

// Load trips — returns local immediately, merges with Supabase
export async function loadTrips(): Promise<GeneratedItinerary[]> {
  const local = localGet();
  if (!supabase) return local;

  try {
    const { data, error } = await supabase
      .from("trips")
      .select("itinerary_json")
      .eq("device_id", getDeviceId())
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data) return local;

    const remote = data.map(r => r.itinerary_json as GeneratedItinerary);
    const map = new Map<string, GeneratedItinerary>();
    [...local, ...remote].forEach(t => map.set(t.id, t));

    return Array.from(map.values())
      .sort((a, b) => {
        const ta = parseInt(a.id.replace("rl-", "")) || 0;
        const tb = parseInt(b.id.replace("rl-", "")) || 0;
        return tb - ta;
      })
      .slice(0, 20);
  } catch {
    return local;
  }
}

// Delete from both
export async function deleteTrip(id: string): Promise<void> {
  localDelete(id);
  if (!supabase) return;
  await supabase
    .from("trips")
    .delete()
    .eq("id", id)
    .eq("device_id", getDeviceId());
}

export function loadCurrentTrip() {
  return localLoadCurrent();
}
