import { useState } from "react";
import { HOTELS_BY_CITY } from "./data";
import type { Hotel } from "./types";

const STORAGE_KEY = "wanderroute_hotels";

function loadUserHotels(): Hotel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Hotel[]) : [];
  } catch {
    return [];
  }
}

function saveUserHotels(hotels: Hotel[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hotels));
  } catch {
    // localStorage may be unavailable — non-fatal
  }
}

/** Merged hotel map: hardcoded HOTELS_BY_CITY + localStorage user-added hotels. */
function buildMergedMap(userHotels: Hotel[]): Record<string, Hotel[]> {
  const merged: Record<string, Hotel[]> = {};
  for (const [city, hotels] of Object.entries(HOTELS_BY_CITY)) {
    merged[city] = hotels.map((h) => ({ ...h, city }));
  }
  for (const hotel of userHotels) {
    if (hotel.city) {
      if (!merged[hotel.city]) merged[hotel.city] = [];
      merged[hotel.city] = [...merged[hotel.city], hotel];
    }
  }
  return merged;
}

export function useHotels() {
  const [userHotels, setUserHotels] = useState<Hotel[]>(loadUserHotels);

  const hotels = buildMergedMap(userHotels);

  const addHotel = (hotel: Hotel) => {
    const updated = [...userHotels, { ...hotel, isUserAdded: true }];
    setUserHotels(updated);
    saveUserHotels(updated);
  };

  const removeHotel = (name: string, city: string) => {
    const updated = userHotels.filter((h) => !(h.name === name && h.city === city));
    setUserHotels(updated);
    saveUserHotels(updated);
  };

  const updateHotel = (oldName: string, oldCity: string, hotel: Hotel) => {
    const updated = userHotels.map((h) =>
      h.name === oldName && h.city === oldCity ? { ...hotel, isUserAdded: true } : h
    );
    setUserHotels(updated);
    saveUserHotels(updated);
  };

  const exportJSON = () => {
    const allHotels: Hotel[] = Object.entries(hotels).flatMap(([city, list]) =>
      list.map((h) => ({ ...h, city }))
    );
    const blob = new Blob([JSON.stringify(allHotels, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wanderroute-hotels.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return { hotels, userHotels, addHotel, removeHotel, updateHotel, exportJSON };
}
