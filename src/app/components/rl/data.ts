import type {
  TripInputs,
  GeneratedItinerary,
  DayPlan,
  DayItem,
  CostBreakdown,
  Currency,
  TravelStyle,
} from "./types";
import { distributeDays, resolveCities } from "../../lib/cityPlan";
import { MUST_SEE } from "../../lib/curatedPlaces";

// ─── Currency Rates vs USD ───────────────────────────────────────────────────
export const CURRENCY_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  AUD: 1.53,
  LKR: 320,
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  LKR: "LKR",
};

// ─── Style Cost Multipliers ──────────────────────────────────────────────────
const STYLE_M: Record<TravelStyle, { hotel: number; food: number; transport: number; activity: number }> = {
  budget: { hotel: 1, food: 1, transport: 1, activity: 1 },
  comfort: { hotel: 3.5, food: 2.2, transport: 1.8, activity: 2 },
  luxury: { hotel: 11, food: 4.5, transport: 3.5, activity: 3 },
};

// ─── Popular Routes ──────────────────────────────────────────────────────────
export const POPULAR_ROUTES = [
  {
    key: "classic",
    name: "Classic Sri Lanka",
    cities: ["Colombo", "Kandy", "Ella", "Mirissa"],
    duration: "7–10 days",
    fromPrice: 280,
    type: "Culture + Beach",
    gradient: "linear-gradient(135deg, #0B1340 0%, #1a3a6b 50%, #0D4A3A 100%)",
    tags: ["UNESCO Sites", "Train Ride", "Beach"],
    description:
      "The quintessential Sri Lanka circuit — colonial cities, misty highlands, and turquoise shores.",
    highlights: ["Scenic train Kandy → Ella", "Nine Arch Bridge", "Mirissa whale watching"],
    startCities: ["Colombo"],
    image: "🏛️",
  },
  {
    key: "north_east",
    name: "Ancient Capitals",
    cities: ["Negombo", "Sigiriya", "Dambulla", "Trincomalee"],
    duration: "5–7 days",
    fromPrice: 230,
    type: "History + Beach",
    gradient: "linear-gradient(135deg, #1a3a0D 0%, #2d5a1a 50%, #0B5A6B 100%)",
    tags: ["Rock Fortress", "Caves", "East Coast"],
    description:
      "Ancient civilizations, UNESCO-listed cave temples, and pristine east coast beaches.",
    highlights: ["Sigiriya Rock Fortress ($30 entry)", "Dambulla Cave Temple", "Pigeon Island snorkeling"],
    startCities: ["Negombo", "Colombo"],
    image: "🏰",
  },
  {
    key: "hill_country",
    name: "Tea Country",
    cities: ["Kandy", "Nuwara Eliya", "Ella"],
    duration: "4–6 days",
    fromPrice: 190,
    type: "Mountains + Tea",
    gradient: "linear-gradient(135deg, #1a2d0D 0%, #2a4a0a 50%, #3D5A1a 100%)",
    tags: ["Tea Estates", "Waterfalls", "Trekking"],
    description:
      "Emerald tea plantations, misty mountain towns, and adrenaline hikes above the clouds.",
    highlights: ["Horton Plains & World's End", "Little Adam's Peak", "Gregory Lake, Nuwara Eliya"],
    startCities: ["Kandy"],
    image: "🌿",
  },
  {
    key: "south_coast",
    name: "Southern Coast",
    cities: ["Colombo", "Galle", "Unawatuna", "Mirissa"],
    duration: "5–7 days",
    fromPrice: 210,
    type: "Colonial + Beach",
    gradient: "linear-gradient(135deg, #2d0B40 0%, #3a1a6b 50%, #0D3A5A 100%)",
    tags: ["Dutch Fort", "Surf", "Whale Watching"],
    description:
      "Historic Dutch colonial forts, surf breaks, and the best whale watching in Asia.",
    highlights: ["Galle Dutch Fort (UNESCO)", "Unawatuna beach snorkeling", "Blue whale sightings off Mirissa"],
    startCities: ["Colombo"],
    image: "🌊",
  },
  {
    key: "wildlife_ruins",
    name: "Wildlife & Ruins",
    cities: ["Colombo", "Dambulla", "Sigiriya", "Minneriya", "Trincomalee"],
    duration: "6–8 days",
    fromPrice: 210,
    type: "Wildlife + History",
    gradient: "linear-gradient(135deg, #3D1a0B 0%, #6B3a1a 50%, #1a5A0B 100%)",
    tags: ["Elephant Gathering", "Rock Fortress", "Ruins"],
    description:
      "Ancient ruins, giant rock fortresses, and Asia's largest elephant gathering.",
    highlights: ["Minneriya elephant gathering (Aug-Oct)", "Sigiriya Lion Rock", "Trincomalee Koneswaram Temple"],
    startCities: ["Colombo"],
    image: "🐘",
  },
  {
    key: "colombo_weekend",
    name: "Colombo Weekend Escape",
    cities: ["Colombo", "Negombo", "Kalpitiya"],
    duration: "2–3 days",
    fromPrice: 90,
    type: "City + Beach",
    gradient: "linear-gradient(135deg, #0B2d5A 0%, #0D5A6B 50%, #1a3A5A 100%)",
    tags: ["Lagoon", "Kitesurfing", "Seafood"],
    description:
      "A short escape from Colombo — lagoon beaches and world-class kitesurfing.",
    highlights: ["Kalpitiya lagoon kitesurfing", "Dutch Bay dolphin watching", "Colombo food scene"],
    startCities: ["Colombo"],
    image: "🪁",
  },
  {
    key: "northern_explorer",
    name: "Northern Explorer",
    cities: ["Colombo", "Anuradhapura", "Jaffna"],
    duration: "5–7 days",
    fromPrice: 175,
    type: "Ancient History",
    gradient: "linear-gradient(135deg, #2d0B3a 0%, #5A1a6B 50%, #3a0B5A 100%)",
    tags: ["Ancient Capital", "Tamil Culture", "Sacred Sites"],
    description:
      "Explore Sri Lanka's ancient Buddhist capitals and the vibrant Tamil culture of the north.",
    highlights: ["Anuradhapura sacred city (UNESCO)", "Jaffna Fort", "Nainativu Island temple"],
    startCities: ["Colombo"],
    image: "🏛️",
  },
  {
    key: "surf_surf",
    name: "Surf & Surf",
    cities: ["Colombo", "Hikkaduwa", "Arugam Bay"],
    duration: "7–10 days",
    fromPrice: 240,
    type: "Surf + Beach",
    gradient: "linear-gradient(135deg, #0B3A5A 0%, #0D6B5A 50%, #1a5A3A 100%)",
    tags: ["World-Class Surf", "Coral Reef", "East Coast"],
    description:
      "Chase waves from the south-west to the east coast — two of Asia's best surf destinations.",
    highlights: ["Arugam Bay (top 10 surf spots globally)", "Hikkaduwa coral reef snorkeling", "Pottuvil Lagoon"],
    startCities: ["Colombo"],
    image: "🏄",
  },
];

// ─── Hotels Database ─────────────────────────────────────────────────────────
export const HOTELS_BY_CITY: Record<string, Array<{
  name: string; stars: number; priceUSD: number; type: TravelStyle;
  amenities: string[]; area: string; tip?: string; bookingUrl?: string; agodaUrl?: string;
  location?: [number, number];
}>> = {
  Colombo: [
    { name: "Havelock Place Bungalow", stars: 4, priceUSD: 55, type: "comfort", amenities: ["Pool", "WiFi", "Breakfast"], area: "Colombo 5", tip: "Ask for garden-view room", bookingUrl: "https://www.booking.com/hotel/lk/havelock-place-bungalow.html", location: [6.8883, 79.8599] },
    { name: "Nomad's Colombo Hostel", stars: 2, priceUSD: 12, type: "budget", amenities: ["WiFi", "Lockers", "AC"], area: "Pettah", tip: "Great social atmosphere", bookingUrl: "https://www.booking.com/hotel/lk/nomads-colombo.html", location: [6.9344, 79.8508] },
    { name: "Cinnamon Grand Colombo", stars: 5, priceUSD: 160, type: "luxury", amenities: ["Pool", "Spa", "3 Restaurants", "Gym"], area: "Colombo 3", tip: "Book 60+ days ahead for best rates", bookingUrl: "https://www.booking.com/hotel/lk/cinnamon-grand-colombo.html", location: [6.9220, 79.8473] },
    { name: "Clock Inn Colombo", stars: 2, priceUSD: 18, type: "budget", amenities: ["WiFi", "AC", "Breakfast"], area: "Colombo 2", bookingUrl: "https://www.booking.com/hotel/lk/clock-inn-colombo.html", location: [6.9175, 79.8508] },
  ],
  Kandy: [
    { name: "Hotel Topaz Kandy", stars: 3, priceUSD: 30, type: "comfort", amenities: ["Pool", "WiFi", "Restaurant"], area: "Kandy Hill", tip: "Amazing lake views from rooftop", bookingUrl: "https://www.booking.com/hotel/lk/topaz-kandy.html", location: [7.3033, 80.6350] },
    { name: "McLeod Inn", stars: 2, priceUSD: 14, type: "budget", amenities: ["WiFi", "Breakfast"], area: "Near Temple", tip: "Walking distance to Temple of Tooth", bookingUrl: "https://www.booking.com/hotel/lk/mcleod-inn.html", location: [7.2940, 80.6413] },
    { name: "Amaya Hills Kandy", stars: 4, priceUSD: 120, type: "luxury", amenities: ["Infinity Pool", "Spa", "Views", "Yoga"], area: "Kandy Hills", bookingUrl: "https://www.booking.com/hotel/lk/amaya-hills.html", location: [7.3100, 80.6200] },
    { name: "Freedom Lodge Kandy", stars: 2, priceUSD: 11, type: "budget", amenities: ["WiFi", "Garden"], area: "Peradeniya", bookingUrl: "https://www.booking.com/hotel/lk/freedom-lodge-kandy.html", location: [7.2669, 80.5966] },
  ],
  Ella: [
    { name: "98 Acres Resort & Spa", stars: 4, priceUSD: 130, type: "luxury", amenities: ["Infinity Pool", "Spa", "Mountain Views", "Restaurant"], area: "Ella", tip: "Book 3 months ahead — sells out fast", bookingUrl: "https://www.booking.com/hotel/lk/98-acres-resort-and-spa-ella.html", location: [6.8700, 81.0550] },
    { name: "Ella Guesthouse", stars: 2, priceUSD: 15, type: "budget", amenities: ["WiFi", "Breakfast", "Terrace"], area: "Ella Town", bookingUrl: "https://www.booking.com/hotel/lk/ella-guesthouse.html", location: [6.8667, 81.0466] },
    { name: "Zion View Ella", stars: 3, priceUSD: 40, type: "comfort", amenities: ["Valley Views", "Restaurant", "WiFi"], area: "Ella Gap", bookingUrl: "https://www.booking.com/hotel/lk/zion-view-ella.html", location: [6.8620, 81.0500] },
  ],
  Mirissa: [
    { name: "Paradise Beach Club", stars: 3, priceUSD: 45, type: "comfort", amenities: ["Beach Access", "Pool", "Bar"], area: "Mirissa Beach", tip: "Get ocean-facing room for sunrise", bookingUrl: "https://www.booking.com/hotel/lk/paradise-beach-club-mirissa.html", location: [5.9475, 80.4716] },
    { name: "Mirissa Hostel", stars: 1, priceUSD: 10, type: "budget", amenities: ["WiFi", "Common Kitchen"], area: "Mirissa", bookingUrl: "https://www.booking.com/hotel/lk/mirissa-hostel.html", location: [5.9483, 80.4700] },
    { name: "Anantara Peace Haven Tangalle", stars: 5, priceUSD: 280, type: "luxury", amenities: ["Private Villas", "Spa", "2 Pools", "Beach"], area: "Tangalle (15 min)", bookingUrl: "https://www.booking.com/hotel/lk/anantara-peace-haven-tangalle-resort.html", location: [6.0230, 80.7980] },
  ],
  Sigiriya: [
    { name: "Sigiriya Village Hotel", stars: 4, priceUSD: 90, type: "luxury", amenities: ["Pool", "Garden", "WiFi", "Restaurant"], area: "Sigiriya Village", bookingUrl: "https://www.booking.com/hotel/lk/sigiriya-village.html", location: [7.9520, 80.7550] },
    { name: "Elephant Corridor", stars: 5, priceUSD: 350, type: "luxury", amenities: ["Plunge pools", "Jeep safaris", "Chef dinners"], area: "Sigiriya", bookingUrl: "https://www.booking.com/hotel/lk/elephant-corridor-sigiriya.html", location: [7.9600, 80.7620] },
    { name: "Back of Beyond Sigiriya", stars: 2, priceUSD: 18, type: "budget", amenities: ["Eco-lodge", "Garden", "WiFi"], area: "Village", bookingUrl: "https://www.booking.com/hotel/lk/back-of-beyond-sigiriya.html", location: [7.9480, 80.7580] },
  ],
  Galle: [
    { name: "Fortaleza at Fort Printers", stars: 4, priceUSD: 145, type: "luxury", amenities: ["Boutique", "Colonial Architecture", "Pool"], area: "Galle Fort", bookingUrl: "https://www.booking.com/hotel/lk/fort-printers-boutique-hotel.html", location: [6.0258, 80.2170] },
    { name: "New Old Dutch House", stars: 3, priceUSD: 35, type: "comfort", amenities: ["Fort Location", "WiFi", "Garden"], area: "Galle Fort", tip: "Inside the UNESCO fort walls", bookingUrl: "https://www.booking.com/hotel/lk/new-old-dutch-house-galle-fort.html", location: [6.0265, 80.2175] },
    { name: "Galle Fort Hostel", stars: 1, priceUSD: 12, type: "budget", amenities: ["WiFi", "Fort Views"], area: "Galle Fort", bookingUrl: "https://www.booking.com/hotel/lk/galle-fort-hostel.html", location: [6.0271, 80.2168] },
  ],
  "Nuwara Eliya": [
    { name: "Ferncliff Bungalow", stars: 2, priceUSD: 14, type: "budget", amenities: ["WiFi", "Breakfast", "Garden"], area: "Nuwara Eliya Town", bookingUrl: "https://www.booking.com/hotel/lk/ferncliff-bungalow-nuwara-eliya.html", location: [6.9500, 80.7820] },
    { name: "Heritance Tea Factory", stars: 5, priceUSD: 95, type: "comfort", amenities: ["Pool", "Restaurant", "WiFi", "Spa"], area: "Kandapola", tip: "Book the tea estate room for views over the plantation", bookingUrl: "https://www.booking.com/hotel/lk/heritance-tea-factory.html", location: [6.9850, 80.8200] },
    { name: "Araliya Green Hills", stars: 4, priceUSD: 180, type: "luxury", amenities: ["Pool", "Spa", "Gym", "Restaurant"], area: "Gregory Lake", bookingUrl: "https://www.booking.com/hotel/lk/araliya-green-hills.html", location: [6.9560, 80.7720] },
  ],
  Trincomalee: [
    { name: "Welcombe Hotel", stars: 2, priceUSD: 12, type: "budget", amenities: ["WiFi", "AC"], area: "Inner Harbour Rd", bookingUrl: "https://www.booking.com/hotel/lk/welcombe-hotel-trincomalee.html", location: [8.5650, 81.2300] },
    { name: "Chaaya Blu Trincomalee", stars: 4, priceUSD: 85, type: "comfort", amenities: ["Pool", "Beach Access", "Restaurant", "WiFi"], area: "Nilaveli Beach", tip: "Steps from Nilaveli beach, book sea-facing rooms", bookingUrl: "https://www.booking.com/hotel/lk/chaaya-blu-trincomalee.html", location: [8.6900, 81.1900] },
    { name: "Jungle Beach by Uga Escapes", stars: 5, priceUSD: 220, type: "luxury", amenities: ["Pool", "Spa", "Beach Access", "Restaurant"], area: "Kuchchaveli", bookingUrl: "https://www.booking.com/hotel/lk/jungle-beach-by-uga-escapes.html", location: [8.7400, 81.1600] },
  ],
  Negombo: [
    { name: "Iceberg Guesthouse", stars: 2, priceUSD: 13, type: "budget", amenities: ["WiFi", "AC", "Garden"], area: "Lewis Place", bookingUrl: "https://www.booking.com/hotel/lk/iceberg-guesthouse-negombo.html", location: [7.2120, 79.8380] },
    { name: "Beach Cabanas Resort", stars: 3, priceUSD: 50, type: "comfort", amenities: ["Pool", "Beach Access", "Restaurant", "WiFi"], area: "Ethukala", bookingUrl: "https://www.booking.com/hotel/lk/beach-cabanas-resort-negombo.html", location: [7.2250, 79.8380] },
    { name: "Jetwing Blue", stars: 5, priceUSD: 140, type: "luxury", amenities: ["Pool", "Spa", "Beach Access", "Restaurant", "Gym"], area: "Negombo Beach", bookingUrl: "https://www.booking.com/hotel/lk/jetwing-blue.html", location: [7.2300, 79.8360] },
  ],
  Dambulla: [
    { name: "Dambulla Rest House", stars: 2, priceUSD: 11, type: "budget", amenities: ["WiFi", "Breakfast"], area: "Dambulla Town", bookingUrl: "https://www.booking.com/hotel/lk/dambulla-rest-house.html", location: [7.8675, 80.6517] },
    { name: "Kandalama Hotel", stars: 4, priceUSD: 70, type: "comfort", amenities: ["Pool", "Restaurant", "WiFi"], area: "Kandalama", tip: "Designed by Geoffrey Bawa — the infinity pool overlooks the Kandalama tank", bookingUrl: "https://www.booking.com/hotel/lk/kandalama.html", location: [7.8740, 80.6900] },
    { name: "Heritance Kandalama", stars: 5, priceUSD: 160, type: "luxury", amenities: ["Pool", "Spa", "Restaurant", "Gym", "WiFi"], area: "Kandalama", bookingUrl: "https://www.booking.com/hotel/lk/heritance-kandalama.html", location: [7.8950, 80.6850] },
  ],
};

// ─── Generic Fallback Route Builder ───────────────────────────
//
// Used when the AI call fails. The old fixed templates only worked for the four
// cities they hardcoded; this builds a day plan for any ordered city list while
// keeping the same DayPlan shape, cost model and item categories.

// Base per-person USD before the style multiplier, taken from the day patterns
// the classic template used.
const BASE_HOTEL_USD = 14;
const BASE_FOOD_USD = 10;
const BASE_TRANSPORT_ARRIVAL_USD = 15;
const BASE_TRANSPORT_USD = 6;
const BASE_ACTIVITY_USD = 10;

const CITY_FLAGS: Record<string, string> = {
  Colombo: "🌆",
  Negombo: "🐟",
  Kandy: "🏺",
  Ella: "🏔️",
  Mirissa: "🏖️",
  Galle: "🏰",
  Sigiriya: "🗿",
  Dambulla: "🛕",
  "Nuwara Eliya": "🍃",
  Trincomalee: "🌊",
  Hikkaduwa: "🏄",
  "Arugam Bay": "🏄",
  Anuradhapura: "🏛️",
  Polonnaruwa: "🏛️",
  "Tissamaharama/Yala": "🐘",
  Bentota: "🌴",
};

const GRADIENTS = [
  "linear-gradient(135deg, #0B1340, #1D3A6B)",
  "linear-gradient(135deg, #1D2456, #0D4A2A)",
  "linear-gradient(135deg, #0D3A2A, #1a5a1a)",
  "linear-gradient(135deg, #1a3a0D, #2d6b1a)",
  "linear-gradient(135deg, #0B2d50, #0D5A4A)",
  "linear-gradient(135deg, #2d0B40, #3a1a6b)",
];

const CITY_TIPS: Record<string, string> = {
  Colombo: "Use the PickMe app (Sri Lanka's Uber) for tuk-tuks — 30–40% cheaper than street hailing.",
  Negombo: "The fish market is at its best just after sunrise, before the day's catch is sold off.",
  Kandy: "Buy Peradeniya Botanical Gardens tickets at the main gate in LKR — hotel bookings carry a markup.",
  Ella: "Time the Nine Arch Bridge for a train crossing — check the updated schedule at the station.",
  Mirissa: "Whale watching costs $25–65. Book operators that keep 100m from the animals.",
  Galle: "Walk the fort ramparts at sunrise — completely empty before the day-trippers arrive, and free.",
  Sigiriya: "Sigiriya entry is $30/person. Start the climb at 7am to beat both the heat and the queues.",
  Dambulla: "The cave temple climb takes 20 minutes. Shoulders and knees must be covered.",
  "Nuwara Eliya": "Nights get genuinely cold here — the one place in Sri Lanka you will want a jacket.",
  Trincomalee: "Nilaveli and Uppuveli beaches are calmest May–September, the opposite of the south coast.",
  Hikkaduwa: "Snorkel gear rents for about $3 on the beach — skip the hotel packages.",
  "Arugam Bay": "Surf season runs April–October. Outside it, the town largely shuts down.",
};

const DEFAULT_TIP =
  "Agree tuk-tuk fares before getting in — $1–2/km is fair anywhere on the island.";

/**
 * A real hotel from our database where we have one for this city and style,
 * otherwise the same style multiplier applied to the budget baseline.
 */
function pickHotel(city: string, style: TravelStyle): { name: string; cost: number } {
  const match = (HOTELS_BY_CITY[city] || []).find((hotel) => hotel.type === style);
  if (match) return { name: match.name, cost: match.priceUSD };

  const label = style.charAt(0).toUpperCase() + style.slice(1);
  return {
    name: `${label} stay in ${city}`,
    cost: Math.round(BASE_HOTEL_USD * STYLE_M[style].hotel),
  };
}

/** Curated landmarks for a city, or a generic exploration item if we have none. */
function activitiesFor(city: string): string[] {
  const seen = MUST_SEE[city];
  if (seen && seen.length > 0) return seen;
  return [`Explore ${city}`, `${city} local market`];
}

function buildGenericRoute(
  cities: string[],
  days: number,
  style: TravelStyle,
  people: number
): DayPlan[] {
  const m = STYLE_M[style];
  const spread = distributeDays(cities.length, days);
  const plans: DayPlan[] = [];

  let dayNumber = 0;

  cities.forEach((city, cityIndex) => {
    const nights = spread[cityIndex] ?? 0;
    const hotel = pickHotel(city, style);
    const landmarks = activitiesFor(city);
    const previousCity = cityIndex > 0 ? cities[cityIndex - 1] : null;

    for (let nightIndex = 0; nightIndex < nights; nightIndex += 1) {
      dayNumber += 1;
      const isTripStart = dayNumber === 1;
      const isCityArrival = nightIndex === 0;

      const transportBase = isTripStart
        ? BASE_TRANSPORT_ARRIVAL_USD
        : BASE_TRANSPORT_USD;

      const items: DayItem[] = [];

      if (isTripStart) {
        items.push({
          time: "10:00",
          icon: "🚕",
          label: "Airport → Hotel Transfer",
          detail: `PickMe taxi from BIA to ${city}`,
          cost: Math.round(BASE_TRANSPORT_ARRIVAL_USD * m.transport),
          category: "transport",
          tip: "Agree the price before getting into any non-app taxi.",
        });
      } else if (isCityArrival && previousCity) {
        items.push({
          time: "09:00",
          icon: "🚌",
          label: `${previousCity} → ${city}`,
          detail: "Road or rail transfer between stops",
          cost: Math.round(BASE_TRANSPORT_USD * m.transport),
          category: "transport",
          tip: "Local buses and 2nd class rail cost a fraction of a private transfer.",
        });
      } else {
        items.push({
          time: "07:30",
          icon: "🍳",
          label: "Breakfast at hotel",
          detail: "Hoppers & coconut sambol",
          cost: Math.round(3 * m.food),
          category: "meal",
        });
      }

      // Rotate through the city's landmarks so a multi-night stay does not
      // repeat the same stop every day.
      const first = landmarks[(nightIndex * 2) % landmarks.length];
      const second = landmarks[(nightIndex * 2 + 1) % landmarks.length];

      items.push({
        time: "11:00",
        icon: "🗺️",
        label: first,
        detail: `Main sight in ${city}`,
        cost: Math.round(BASE_ACTIVITY_USD * m.activity),
        category: "activity",
      });

      items.push({
        time: "13:00",
        icon: "🍛",
        label: "Lunch – local rice & curry",
        detail: "Off the main tourist strip",
        cost: Math.round(4 * m.food),
        category: "meal",
        tip: "Look for packed local places — a full plate runs about $1.10.",
      });

      if (second && second !== first) {
        items.push({
          time: "16:00",
          icon: "📍",
          label: second,
          detail: `Second stop in ${city}`,
          cost: Math.round(4 * m.activity),
          category: "activity",
          isHidden: true,
        });
      }

      items.push({
        time: "20:00",
        icon: "🍽️",
        label: `Dinner in ${city}`,
        detail: style === "budget" ? "Street food & local kade" : "Sit-down local restaurant",
        cost: Math.round((style === "budget" ? 6 : 12) * m.food),
        category: "meal",
      });

      items.push({
        time: "22:00",
        icon: "🏨",
        label: hotel.name,
        detail: isCityArrival ? "Check-in" : `Night ${nightIndex + 1} in ${city}`,
        cost: Math.round(hotel.cost / people),
        category: "accommodation",
      });

      plans.push({
        day: dayNumber,
        city: isCityArrival && previousCity ? `${previousCity} → ${city}` : city,
        flag: CITY_FLAGS[city] || "📍",
        heroGradient: GRADIENTS[(dayNumber - 1) % GRADIENTS.length],
        accommodation: hotel.name,
        accommodationCostPerNight: hotel.cost,
        localTip: CITY_TIPS[city] || DEFAULT_TIP,
        dailyCostPerPerson: Math.round(
          hotel.cost / people +
            BASE_FOOD_USD * m.food +
            transportBase * m.transport +
            BASE_ACTIVITY_USD * m.activity
        ),
        items,
      });
    }
  });

  return plans;
}

// ─── Route Template Matching ──────────────────────────────────
// The itinerary still carries a routeKey for styling and copy. Match the chosen
// cities against the existing templates by overlap; "custom" when none fits.
function closestRouteKey(cities: string[]): string {
  const chosen = new Set(cities.map((city) => city.toLowerCase()));

  let bestKey = "custom";
  let bestOverlap = 0;

  for (const route of POPULAR_ROUTES) {
    const overlap = route.cities.filter((city) => chosen.has(city.toLowerCase())).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestKey = route.key;
    }
  }

  // A single shared city is a coincidence, not a match.
  return bestOverlap >= 2 ? bestKey : "custom";
}

// Names a route that matches none of the templates.
function buildRouteName(cities: string[]): string {
  if (cities.length === 0) return "Your Sri Lanka Route";
  if (cities.length === 1) return `${cities[0]} Escape`;
  return `${cities[0]} to ${cities[cities.length - 1]}`;
}

// One curated landmark per city, so a custom route still has real highlights.
function buildHighlights(cities: string[]): string[] {
  const picks: string[] = [];
  for (const city of cities) {
    const landmark = (MUST_SEE[city] || [])[0];
    if (landmark) picks.push(landmark);
    if (picks.length === 3) break;
  }
  return picks;
}

// ─── Main Generator ──────────────────────────────────────────────────────────
export function generateItinerary(
  inputs: TripInputs,
  rates: Record<Currency, number> = CURRENCY_RATES
): GeneratedItinerary {
  const { budget, currency, days, people, travelStyle } = inputs;
  const rate = rates[currency] ?? CURRENCY_RATES[currency];

  // Ordering and auto-selection happen here too, so a caller passing raw input
  // (or a legacy trip with no cities) still gets a coherent route.
  const { cities } = resolveCities(inputs.cities, days);
  const routeKey = closestRouteKey(cities);
  const route = POPULAR_ROUTES.find((r) => r.key === routeKey) || null;

  let dayPlans: DayPlan[] = buildGenericRoute(cities, days, travelStyle, people);

  // Clamp to requested days
  dayPlans = dayPlans.slice(0, days);

  // Scale each day's cost by currency rate
  const processedDays = dayPlans.map((d, i) => ({
    ...d,
    day: i + 1,
    dailyCostPerPerson: Math.round(d.dailyCostPerPerson * rate),
    accommodationCostPerNight: Math.round(d.accommodationCostPerNight * rate),
    items: d.items.map((item) => ({ ...item, cost: Math.round(item.cost * rate) })),
  }));

  const totalPerPerson = processedDays.reduce((s, d) => s + d.dailyCostPerPerson, 0);
  const totalCost = totalPerPerson * people;
  const remaining = budget - totalCost;
  const budgetStatus =
    remaining > budget * 0.2
      ? "great"
      : remaining > 0
      ? "ok"
      : remaining > -budget * 0.1
      ? "tight"
      : "over";

  // Cost breakdown (rough split)
  const m = STYLE_M[travelStyle];
  const perPersonPerDay = totalPerPerson / Math.max(days, 1);
  const breakdown: CostBreakdown = {
    hotels: Math.round(perPersonPerDay * 0.35 * days * people),
    food: Math.round(perPersonPerDay * 0.25 * days * people),
    transport: Math.round(perPersonPerDay * 0.18 * days * people),
    activities: Math.round(perPersonPerDay * 0.14 * days * people),
    entryFees: Math.round(perPersonPerDay * 0.05 * days * people),
    misc: Math.round(perPersonPerDay * 0.03 * days * people),
  };

  const sym = CURRENCY_SYMBOLS[currency];

  return {
    id: `rl-${Date.now()}`,
    routeName: route ? route.name : buildRouteName(cities),
    routeSlogan: route
      ? route.description
      : "A route built around the cities you chose, ordered to minimise backtracking.",
    routeKey,
    cities,
    totalDays: days,
    totalPeople: people,
    currency,
    estimatedCostPerPerson: totalPerPerson,
    estimatedTotalCost: totalCost,
    inputBudget: budget,
    remainingBudget: remaining,
    budgetStatus,
    travelStyle,
    days: processedDays,
    costBreakdown: breakdown,
    globalTips: [
      `Carry ${sym}20–30 in small cash daily — many local spots don't accept cards.`,
      "Book the Kandy–Ella train 2–3 weeks in advance. Sells out fast in season (Dec–Mar).",
      `Tuk-tuk fares: always agree the price BEFORE getting in. ${sym === "$" ? "$1–2/km" : "Equiv. $1–2/km"} is fair.`,
      "SIM card from Mobitel or Dialog at the airport: ~$5 for 20GB data.",
      "Tap water is not safe to drink. Buy large 1.5L bottles (~$0.40) from shops, not hotel mini-bars.",
      "Bargaining is expected at markets, but not at fixed-price shops. Start at 40% of asking price.",
    ],
    warnings: [
      ...(budgetStatus === "tight" || budgetStatus === "over"
        ? [`⚠️ Your budget is ${budgetStatus === "over" ? "below" : "close to"} the estimated cost. Consider reducing trip length or choosing Budget travel style.`]
        : []),
      "⚠️ Sigiriya entry fee ($30/person) is a hidden cost many tourists don't budget for.",
      "⚠️ Whale watching costs vary: $25–65/person. Book ethical operators only.",
      "⚠️ Hotel prices surge 2–3x during Christmas/New Year (Dec 20 – Jan 5).",
    ],
    highlights: route ? route.highlights : buildHighlights(cities),
  };
}
