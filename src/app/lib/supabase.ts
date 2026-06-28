import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn("⚠️ Supabase credentials missing — running in offline mode");
}

export const supabase = (url && key) ? createClient(url, key) : null;

export type DbPlace = {
  id?: string;
  name: string;
  city: string;
  category: "hotel" | "restaurant" | "attraction" | "beach" | "temple";
  style?: "budget" | "comfort" | "luxury";
  lat?: number;
  lng?: number;
  price_usd?: number;
  stars?: number;
  rating?: number;
  description?: string;
  amenities?: string[];
  area?: string;
  tip?: string;
  booking_url?: string;
  agoda_url?: string;
  image_url?: string;
  source?: string;
};

export type DbTrip = {
  id: string;
  route_name: string;
  route_slogan?: string;
  cities?: string[];
  total_days?: number;
  total_people?: number;
  currency?: string;
  estimated_total_cost?: number;
  estimated_cost_per_person?: number;
  input_budget?: number;
  remaining_budget?: number;
  budget_status?: string;
  travel_style?: string;
  itinerary_json: object;
  created_at?: string;
  device_id?: string;
};
