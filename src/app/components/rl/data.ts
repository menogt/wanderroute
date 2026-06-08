import type {
  TripInputs,
  GeneratedItinerary,
  DayPlan,
  CostBreakdown,
  Currency,
  TravelStyle,
} from "./types";

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
];

// ─── Hotels Database ─────────────────────────────────────────────────────────
export const HOTELS_BY_CITY: Record<string, Array<{
  name: string; stars: number; priceUSD: number; type: TravelStyle;
  amenities: string[]; area: string; tip?: string;
}>> = {
  Colombo: [
    { name: "Havelock Place Bungalow", stars: 4, priceUSD: 55, type: "comfort", amenities: ["Pool", "WiFi", "Breakfast"], area: "Colombo 5", tip: "Ask for garden-view room" },
    { name: "Nomad's Colombo Hostel", stars: 2, priceUSD: 12, type: "budget", amenities: ["WiFi", "Lockers", "AC"], area: "Pettah", tip: "Great social atmosphere" },
    { name: "Cinnamon Grand Colombo", stars: 5, priceUSD: 160, type: "luxury", amenities: ["Pool", "Spa", "3 Restaurants", "Gym"], area: "Colombo 3", tip: "Book 60+ days ahead for best rates" },
    { name: "Clock Inn Colombo", stars: 2, priceUSD: 18, type: "budget", amenities: ["WiFi", "AC", "Breakfast"], area: "Colombo 2" },
  ],
  Kandy: [
    { name: "Hotel Topaz Kandy", stars: 3, priceUSD: 30, type: "comfort", amenities: ["Pool", "WiFi", "Restaurant"], area: "Kandy Hill", tip: "Amazing lake views from rooftop" },
    { name: "McLeod Inn", stars: 2, priceUSD: 14, type: "budget", amenities: ["WiFi", "Breakfast"], area: "Near Temple", tip: "Walking distance to Temple of Tooth" },
    { name: "Amaya Hills Kandy", stars: 4, priceUSD: 120, type: "luxury", amenities: ["Infinity Pool", "Spa", "Views", "Yoga"], area: "Kandy Hills" },
    { name: "Freedom Lodge Kandy", stars: 2, priceUSD: 11, type: "budget", amenities: ["WiFi", "Garden"], area: "Peradeniya" },
  ],
  Ella: [
    { name: "98 Acres Resort & Spa", stars: 4, priceUSD: 130, type: "luxury", amenities: ["Infinity Pool", "Spa", "Mountain Views", "Restaurant"], area: "Ella", tip: "Book 3 months ahead — sells out fast" },
    { name: "Ella Guesthouse", stars: 2, priceUSD: 15, type: "budget", amenities: ["WiFi", "Breakfast", "Terrace"], area: "Ella Town" },
    { name: "Zion View Ella", stars: 3, priceUSD: 40, type: "comfort", amenities: ["Valley Views", "Restaurant", "WiFi"], area: "Ella Gap" },
  ],
  Mirissa: [
    { name: "Paradise Beach Club", stars: 3, priceUSD: 45, type: "comfort", amenities: ["Beach Access", "Pool", "Bar"], area: "Mirissa Beach", tip: "Get ocean-facing room for sunrise" },
    { name: "Mirissa Hostel", stars: 1, priceUSD: 10, type: "budget", amenities: ["WiFi", "Common Kitchen"], area: "Mirissa" },
    { name: "Anantara Peace Haven Tangalle", stars: 5, priceUSD: 280, type: "luxury", amenities: ["Private Villas", "Spa", "2 Pools", "Beach"], area: "Tangalle (15 min)" },
  ],
  Sigiriya: [
    { name: "Sigiriya Village Hotel", stars: 4, priceUSD: 90, type: "luxury", amenities: ["Pool", "Garden", "WiFi", "Restaurant"], area: "Sigiriya Village" },
    { name: "Elephant Corridor", stars: 5, priceUSD: 350, type: "luxury", amenities: ["Plunge pools", "Jeep safaris", "Chef dinners"], area: "Sigiriya" },
    { name: "Back of Beyond Sigiriya", stars: 2, priceUSD: 18, type: "budget", amenities: ["Eco-lodge", "Garden", "WiFi"], area: "Village" },
  ],
  Galle: [
    { name: "Fortaleza at Fort Printers", stars: 4, priceUSD: 145, type: "luxury", amenities: ["Boutique", "Colonial Architecture", "Pool"], area: "Galle Fort" },
    { name: "New Old Dutch House", stars: 3, priceUSD: 35, type: "comfort", amenities: ["Fort Location", "WiFi", "Garden"], area: "Galle Fort", tip: "Inside the UNESCO fort walls" },
    { name: "Galle Fort Hostel", stars: 1, priceUSD: 12, type: "budget", amenities: ["WiFi", "Fort Views"], area: "Galle Fort" },
  ],
};

// ─── Route Day Plans (base, budget, per person in USD) ──────────────────────

function buildClassicRoute(days: number, style: TravelStyle, people: number): DayPlan[] {
  const m = STYLE_M[style];
  const hotelNames: Record<TravelStyle, Record<string, string>> = {
    budget: { Colombo: "Clock Inn Colombo", Kandy: "McLeod Inn", Ella: "Ella Guesthouse", Mirissa: "Mirissa Hostel" },
    comfort: { Colombo: "Havelock Place Bungalow", Kandy: "Hotel Topaz Kandy", Ella: "Zion View Ella", Mirissa: "Paradise Beach Club" },
    luxury: { Colombo: "Cinnamon Grand Colombo", Kandy: "Amaya Hills Kandy", Ella: "98 Acres Resort & Spa", Mirissa: "Anantara Peace Haven" },
  };

  const hotelCosts: Record<TravelStyle, Record<string, number>> = {
    budget: { Colombo: 18, Kandy: 14, Ella: 15, Mirissa: 10 },
    comfort: { Colombo: 55, Kandy: 30, Ella: 40, Mirissa: 45 },
    luxury: { Colombo: 160, Kandy: 120, Ella: 130, Mirissa: 280 },
  };

  const allDays: DayPlan[] = [
    {
      day: 1, city: "Colombo", flag: "🌆", heroGradient: "linear-gradient(135deg, #0B1340, #1D3A6B)",
      accommodation: hotelNames[style]["Colombo"],
      accommodationCostPerNight: hotelCosts[style]["Colombo"],
      localTip: "Use the PickMe app (Sri Lanka's Uber) for tuk-tuks — 30–40% cheaper than street hailing.",
      dailyCostPerPerson: Math.round((hotelCosts[style]["Colombo"] / people) + 10 * m.food + 15 * m.transport + 8 * m.activity),
      items: [
        { time: "10:00", icon: "🚕", label: "Airport → Hotel Transfer", detail: "PickMe taxi from BIA", cost: Math.round(15 * m.transport), category: "transport", tip: "Agree price before getting in any non-app taxi. Should be ~LKR 4,000 / $12" },
        { time: "12:00", icon: "🍛", label: "Lunch at Upali's", detail: "Authentic rice & curry buffet", cost: Math.round(4 * m.food), category: "meal", tip: "Try the dhal curry — locals swear by it" },
        { time: "14:00", icon: "🌊", label: "Galle Face Green", detail: "Oceanfront promenade, kite watching", cost: 0, category: "activity" },
        { time: "16:00", icon: "🕌", label: "Pettah Market & Mosques", detail: "Chaotic, colorful bazaar district", cost: Math.round(3 * m.transport), category: "activity", isHidden: true, tip: "Hidden gem: the Jami Ul-Alfar Mosque interior is stunning and free" },
        { time: "19:00", icon: "🍽️", label: "Dinner – Ministry of Crab", detail: "Iconic Colombo seafood restaurant", cost: Math.round(18 * m.food), category: "meal", tip: style === "budget" ? "Skip Ministry of Crab — try Upali's again or Nuga Gama for authentic local food under $5" : "Book online — walk-ins wait 2h+" },
        { time: "22:00", icon: "🏨", label: hotelNames[style]["Colombo"], detail: `${style.charAt(0).toUpperCase() + style.slice(1)} accommodation`, cost: Math.round(hotelCosts[style]["Colombo"] / people), category: "accommodation" },
      ],
    },
    {
      day: 2, city: "Colombo → Kandy", flag: "🚂", heroGradient: "linear-gradient(135deg, #1D2456, #0D4A2A)",
      accommodation: hotelNames[style]["Kandy"],
      accommodationCostPerNight: hotelCosts[style]["Kandy"],
      localTip: "The 2nd class train seat is comfortable and costs only $2 — don't overpay for private 'observation' coaches pitched to tourists.",
      dailyCostPerPerson: Math.round((hotelCosts[style]["Kandy"] / people) + 9 * m.food + 6 * m.transport + 12 * m.activity),
      items: [
        { time: "07:30", icon: "🍳", label: "Breakfast at hotel", detail: "Hoppers & coconut sambol", cost: Math.round(3 * m.food), category: "meal" },
        { time: "09:00", icon: "🚂", label: "Train: Colombo Fort → Kandy", detail: "2.5h scenic rail journey", cost: Math.round(3 * m.transport), category: "transport", tip: "Book seats at Fort station the day before. 2nd class is $2, 1st class reserved is $5" },
        { time: "12:00", icon: "🏛️", label: "Temple of the Tooth Relic", detail: "Sacred Buddhist UNESCO site", cost: Math.round(6 * m.activity), category: "activity", tip: "Entry LKR 2,000 (~$6). Visit during puja ceremony at 6:30am, 9:30am, or 6:30pm for free drumming" },
        { time: "15:00", icon: "🌿", label: "Kandy Lake & Upper Lakeside", detail: "Easy walk around the historic lake", cost: 0, category: "activity" },
        { time: "18:00", icon: "🎭", label: "Kandyan Cultural Dance Show", detail: "1hr traditional dance & drumming", cost: Math.round(6 * m.activity), category: "activity", tip: "Buy tickets at the door — cheaper than hotel concierge bookings" },
        { time: "20:00", icon: "🍽️", label: "Dinner – The Empire Café", detail: "Rooftop restaurant, Kandy lake view", cost: Math.round(8 * m.food), category: "meal" },
        { time: "22:00", icon: "🏨", label: hotelNames[style]["Kandy"], detail: "Check-in", cost: Math.round(hotelCosts[style]["Kandy"] / people), category: "accommodation" },
      ],
    },
    {
      day: 3, city: "Kandy", flag: "🌺", heroGradient: "linear-gradient(135deg, #0D3A2A, #1a5a1a)",
      accommodation: hotelNames[style]["Kandy"],
      accommodationCostPerNight: hotelCosts[style]["Kandy"],
      localTip: "Peradeniya Botanical Gardens entry is often quoted at tourist price. Buy LKR tickets at the main gate — don't go through hotel.",
      dailyCostPerPerson: Math.round((hotelCosts[style]["Kandy"] / people) + 9 * m.food + 6 * m.transport + 10 * m.activity),
      items: [
        { time: "08:00", icon: "🌳", label: "Peradeniya Botanical Gardens", detail: "147-acre colonial-era garden, 4,000 species", cost: Math.round(5 * m.activity), category: "activity", tip: "Giant Javan fig tree is 100+ years old. Go early to beat tour groups." },
        { time: "11:00", icon: "🌶️", label: "Spice Garden Tour", detail: "Free tour, learn about cinnamon & spices", cost: 0, category: "activity", isHidden: true, tip: "They will try to sell you products — politely decline if you don't want them" },
        { time: "13:00", icon: "🍛", label: "Lunch – local rice & curry shop", detail: "Off the main tourist strip", cost: Math.round(2.5 * m.food), category: "meal", tip: "Look for packed local places — full rice & curry plate under LKR 350 / $1.10" },
        { time: "15:00", icon: "🛍️", label: "Kandy City Centre & Gem Museum", detail: "Sapphire, moonstone shopping district", cost: Math.round(2 * m.transport), category: "activity", tip: "Never buy gems from street touts. Only from licensed shops with certificates." },
        { time: "17:00", icon: "🏔️", label: "Bahiravokanda Buddha Statue Hike", detail: "30min climb, panoramic Kandy views", cost: 0, category: "activity", isHidden: true },
        { time: "20:00", icon: "🍽️", label: "Dinner – Slightly Chilled", detail: "Rooftop cocktails + wood-fired pizza", cost: Math.round(9 * m.food), category: "meal" },
        { time: "22:00", icon: "🏨", label: hotelNames[style]["Kandy"], detail: "Last night in Kandy", cost: Math.round(hotelCosts[style]["Kandy"] / people), category: "accommodation" },
      ],
    },
    {
      day: 4, city: "Kandy → Ella", flag: "🚂", heroGradient: "linear-gradient(135deg, #1a3a0D, #2d6b1a)",
      accommodation: hotelNames[style]["Ella"],
      accommodationCostPerNight: hotelCosts[style]["Ella"],
      localTip: "The Kandy–Ella train (6–7 hours) is considered one of the world's most scenic train rides. Book seats WEEKS in advance at Kandy station or online at Exprail.lk.",
      dailyCostPerPerson: Math.round((hotelCosts[style]["Ella"] / people) + 10 * m.food + 6 * m.transport + 5 * m.activity),
      items: [
        { time: "06:30", icon: "☕", label: "Early breakfast, pack snacks", detail: "Train snacks are overpriced", cost: Math.round(3 * m.food), category: "meal", tip: "Pack local pastries from the night market for the train journey — saves $8+" },
        { time: "08:47", icon: "🚂", label: "Train: Kandy → Ella", detail: "6.5hr through tea country (scenic!)", cost: Math.round(5 * m.transport), category: "transport", tip: "Sit on the RIGHT side of the train facing Ella for the best views. 2nd class is perfectly comfortable at $3." },
        { time: "15:30", icon: "🛤️", label: "Nine Arch Bridge walk", detail: "15min tuk-tuk + 20min walk from station", cost: Math.round(3 * m.transport + 2 * m.activity), category: "activity", tip: "Time your visit for a train crossing (10:47am, 1:03pm, 3:47pm) — check updated schedule at station" },
        { time: "18:00", icon: "🌅", label: "Ella sunset viewpoint", detail: "Watch sunset over Ella Gap", cost: 0, category: "activity", isHidden: true, tip: "Hidden spot: walk 10min past the Nine Arch bridge turnoff for a private view" },
        { time: "20:00", icon: "🍽️", label: "Dinner – Chill in Ella", detail: "Budget-friendly wood-fire pizza in Ella town", cost: Math.round(7 * m.food), category: "meal" },
        { time: "22:00", icon: "🏨", label: hotelNames[style]["Ella"], detail: "Mountain hideaway check-in", cost: Math.round(hotelCosts[style]["Ella"] / people), category: "accommodation" },
      ],
    },
    {
      day: 5, city: "Ella", flag: "🏔️", heroGradient: "linear-gradient(135deg, #0D3A1a, #1a6b2d)",
      accommodation: hotelNames[style]["Ella"],
      accommodationCostPerNight: hotelCosts[style]["Ella"],
      localTip: "Start Little Adam's Peak hike BEFORE 7am to beat tour groups and catch cloud-free summit views.",
      dailyCostPerPerson: Math.round((hotelCosts[style]["Ella"] / people) + 10 * m.food + 4 * m.transport + 12 * m.activity),
      items: [
        { time: "05:30", icon: "🥾", label: "Little Adam's Peak Sunrise Hike", detail: "1.5hr moderate trail, panoramic views", cost: 0, category: "activity", tip: "Completely free — ignore anyone asking for entry fees, there are none" },
        { time: "09:00", icon: "🍳", label: "Breakfast at Dream Café", detail: "Famous egg hoppers & views", cost: Math.round(4 * m.food), category: "meal" },
        { time: "11:00", icon: "🫖", label: "Tea Factory Tour", detail: "See how Ceylon tea is processed", cost: Math.round(3 * m.activity), category: "activity", isHidden: true, tip: "Uva Halpewatte Tea Factory does free tours — just show up" },
        { time: "14:00", icon: "💧", label: "Ravana Falls & Waterfall Swim", detail: "Sacred 25m waterfall, swimming pool below", cost: Math.round(2 * m.activity), category: "activity" },
        { time: "17:00", icon: "🪂", label: "Ella Rock Hike (Optional)", detail: "3hr advanced trail, 1,041m summit", cost: 0, category: "activity", isHidden: true, tip: "Go with a guide ($8) — trail is poorly marked. Worth it for the payoff views." },
        { time: "20:00", icon: "🍽️", label: "Dinner – Ella's Best Restaurant", detail: "Sri Lankan kottu & devilled prawns", cost: Math.round(8 * m.food), category: "meal" },
        { time: "22:00", icon: "🏨", label: hotelNames[style]["Ella"], detail: "Last night in the hills", cost: Math.round(hotelCosts[style]["Ella"] / people), category: "accommodation" },
      ],
    },
    {
      day: 6, city: "Ella → Mirissa", flag: "🌊", heroGradient: "linear-gradient(135deg, #0B1a40, #0D3A5A)",
      accommodation: hotelNames[style]["Mirissa"],
      accommodationCostPerNight: hotelCosts[style]["Mirissa"],
      localTip: "The bus from Ella to Mirissa takes 3.5–4 hours and costs ~$3. Cheaper than a private van ($35) — and locals use it.",
      dailyCostPerPerson: Math.round((hotelCosts[style]["Mirissa"] / people) + 11 * m.food + 10 * m.transport + 8 * m.activity),
      items: [
        { time: "08:00", icon: "🍛", label: "Checkout breakfast", detail: "Last hoppers in the hills", cost: Math.round(3 * m.food), category: "meal" },
        { time: "09:30", icon: "🚌", label: "Bus: Ella → Mirissa", detail: "Via Wellawaya, 3.5–4 hours", cost: Math.round(4 * m.transport), category: "transport", tip: "Take the 9:30am bus from Ella bus stand. Sit on left side — best views going south. Don't take minivans offered at the train station." },
        { time: "14:00", icon: "🏖️", label: "Check-in & Beach", detail: "First taste of Mirissa beach", cost: Math.round(hotelCosts[style]["Mirissa"] / people), category: "accommodation", tip: "Mirissa beach gets crowded mid-afternoon. The eastern end near the coconut tree is quieter." },
        { time: "17:00", icon: "🥥", label: "Sunset cocktails at Secret Beach Bar", detail: "Hidden bar, locals' favourite", cost: Math.round(7 * m.food), category: "meal", isHidden: true },
        { time: "20:00", icon: "🦞", label: "Dinner – Dewmini Roti Shop", detail: "Famous roti spot, under $3/person", cost: Math.round(3 * m.food), category: "meal", tip: style === "budget" ? "Dewmini's is a Mirissa legend — full meal under LKR 800. Cash only." : "Still worth a visit even on a comfort budget — best roti in Sri Lanka" },
      ],
    },
    {
      day: 7, city: "Mirissa", flag: "🐋", heroGradient: "linear-gradient(135deg, #0B2A50, #0D5A6B)",
      accommodation: hotelNames[style]["Mirissa"],
      accommodationCostPerNight: hotelCosts[style]["Mirissa"],
      localTip: "Whale watching season: November – April. Blue whales are seen ~80% of trips. Book with Raja & the Whales — ethical, no crowding boats.",
      dailyCostPerPerson: Math.round((hotelCosts[style]["Mirissa"] / people) + 12 * m.food + 5 * m.transport + 15 * m.activity),
      items: [
        { time: "06:00", icon: "🐋", label: "Whale Watching Boat Tour", detail: "3-4hr ocean expedition", cost: Math.round(40 * m.activity), category: "activity", tip: "Seasickness? Take a pill the night before. Best boats: Raja & the Whales ($40/pp), Mirissa Water Sports ($35). Avoid cheapest operators — they overcrowd." },
        { time: "11:00", icon: "🏊", label: "Parrot Rock Snorkeling", detail: "15min walk from main beach, free entry", cost: 0, category: "activity", isHidden: true, tip: "Parrot Rock at the east end of Mirissa beach is a hidden snorkel spot — no crowds" },
        { time: "14:00", icon: "🍜", label: "Beachside rice & curry lunch", detail: "Under the coconut palms", cost: Math.round(5 * m.food), category: "meal" },
        { time: "17:00", icon: "🌅", label: "Coconut Tree Hill Sunset", detail: "Mirissa's iconic Instagram viewpoint", cost: 0, category: "activity" },
        { time: "20:00", icon: "🍽️", label: "Farewell seafood dinner", detail: "Grilled catch of the day, Mirissa Harbour", cost: Math.round(15 * m.food), category: "meal", tip: "Negotiate price of fish per kilo before agreeing — normal is ~LKR 1,200/kilo" },
        { time: "22:00", icon: "🏨", label: hotelNames[style]["Mirissa"], detail: "Last night in paradise", cost: Math.round(hotelCosts[style]["Mirissa"] / people), category: "accommodation" },
      ],
    },
  ];

  if (days <= 7) return allDays;
  if (days === 8) return [...allDays.slice(0, 5), {
    ...allDays[5],
    day: 6,
    items: [{ time: "09:00", icon: "🏊", label: "Free morning at beach", detail: "Swim, read, relax in Ella", cost: 0, category: "activity" }, ...allDays[5].items.slice(2)],
  }, { ...allDays[5], day: 7, city: "Ella → Mirissa" }, { ...allDays[6], day: 8 }];
  return [...allDays, {
    ...allDays[6],
    day: days,
    city: "Mirissa",
    items: [{ time: "09:00", icon: "🏄", label: "Surf lesson at Mirissa", detail: "1.5hr beginner lesson", cost: Math.round(20 * m.activity), category: "activity" }, ...allDays[6].items.slice(1)],
  }];
}

function buildSouthCoastRoute(days: number, style: TravelStyle, people: number): DayPlan[] {
  const m = STYLE_M[style];
  const hotelCosts: Record<TravelStyle, Record<string, number>> = {
    budget: { Colombo: 18, Galle: 12, Unawatuna: 14, Mirissa: 10 },
    comfort: { Colombo: 55, Galle: 35, Unawatuna: 50, Mirissa: 45 },
    luxury: { Colombo: 160, Galle: 145, Unawatuna: 130, Mirissa: 280 },
  };
  const hotelNames: Record<TravelStyle, Record<string, string>> = {
    budget: { Colombo: "Clock Inn Colombo", Galle: "Galle Fort Hostel", Unawatuna: "Unawatuna Budget Inn", Mirissa: "Mirissa Hostel" },
    comfort: { Colombo: "Havelock Place Bungalow", Galle: "New Old Dutch House", Unawatuna: "Secret Garden Villa", Mirissa: "Paradise Beach Club" },
    luxury: { Colombo: "Cinnamon Grand Colombo", Galle: "Fortaleza at Fort Printers", Unawatuna: "Thambapanni Retreat", Mirissa: "Anantara Peace Haven" },
  };

  return [
    {
      day: 1, city: "Colombo", flag: "🌆", heroGradient: "linear-gradient(135deg, #0B1340, #1D3A6B)",
      accommodation: hotelNames[style]["Colombo"], accommodationCostPerNight: hotelCosts[style]["Colombo"],
      localTip: "Colombo's Uber-equivalent is PickMe — always cheaper than hailing a tuk-tuk on the street.",
      dailyCostPerPerson: Math.round(hotelCosts[style]["Colombo"] / people + 10 * m.food + 12 * m.transport + 5 * m.activity),
      items: [
        { time: "10:00", icon: "🚕", label: "Airport arrival & transfer", detail: "PickMe to hotel", cost: Math.round(15 * m.transport), category: "transport", tip: "App taxi from BIA is ~LKR 3,500–4,000. Avoid tours desks at the airport." },
        { time: "13:00", icon: "🍛", label: "Lunch – Barefoot Garden Café", detail: "Arty Colombo 3 institution", cost: Math.round(5 * m.food), category: "meal" },
        { time: "15:00", icon: "🌊", label: "Galle Face Green walk", detail: "Ocean promenade, local life", cost: 0, category: "activity" },
        { time: "17:00", icon: "🏛️", label: "National Museum of Colombo", detail: "Sri Lanka history & artefacts", cost: Math.round(2 * m.activity), category: "activity" },
        { time: "20:00", icon: "🍽️", label: "Dinner – Nuga Gama", detail: "Village-style authentic Sri Lankan", cost: Math.round(12 * m.food), category: "meal" },
        { time: "22:00", icon: "🏨", label: hotelNames[style]["Colombo"], detail: "Night in Colombo", cost: Math.round(hotelCosts[style]["Colombo"] / people), category: "accommodation" },
      ],
    },
    {
      day: 2, city: "Colombo → Galle", flag: "🏰", heroGradient: "linear-gradient(135deg, #2d0B40, #3a1a6b)",
      accommodation: hotelNames[style]["Galle"], accommodationCostPerNight: hotelCosts[style]["Galle"],
      localTip: "Galle Fort's streets are best explored on foot at sunrise — completely empty and magical before the day-trippers arrive.",
      dailyCostPerPerson: Math.round(hotelCosts[style]["Galle"] / people + 11 * m.food + 8 * m.transport + 10 * m.activity),
      items: [
        { time: "09:00", icon: "🚌", label: "Express bus: Colombo → Galle", detail: "2.5hr Southern Expressway", cost: Math.round(4 * m.transport), category: "transport", tip: "Take the AC express bus from Saunders Place ($1.50) — not the slow coastal highway bus" },
        { time: "12:00", icon: "🏰", label: "Galle Dutch Fort walk", detail: "16th-century UNESCO fort walls", cost: 0, category: "activity", tip: "The fort ramparts walk (45min) gives stunning ocean views. Completely free." },
        { time: "14:00", icon: "🍽️", label: "Lunch inside the Fort", detail: "Pedlar & Prince for local food", cost: Math.round(8 * m.food), category: "meal" },
        { time: "16:00", icon: "🔭", label: "Galle Lighthouse & Ramparts", detail: "Sunset from the fort walls", cost: 0, category: "activity", isHidden: true },
        { time: "18:00", icon: "🛍️", label: "Fort boutiques & galleries", detail: "Laksala, Paradise Road, gem shops", cost: 0, category: "activity" },
        { time: "20:00", icon: "🍽️", label: "Dinner – Fortaleza Restaurant", detail: "Colonial-era fine dining", cost: Math.round(20 * m.food), category: "meal" },
        { time: "22:00", icon: "🏨", label: hotelNames[style]["Galle"], detail: "Sleep inside the fort walls", cost: Math.round(hotelCosts[style]["Galle"] / people), category: "accommodation" },
      ],
    },
    {
      day: Math.min(3, days - 1), city: "Galle → Unawatuna → Mirissa", flag: "🏖️", heroGradient: "linear-gradient(135deg, #0B2d50, #0D5A4A)",
      accommodation: hotelNames[style]["Mirissa"], accommodationCostPerNight: hotelCosts[style]["Mirissa"],
      localTip: "Unawatuna beach is 3km from Galle Fort — share a tuk-tuk with other travelers ($1 each). Don't take hotel-arranged transfers.",
      dailyCostPerPerson: Math.round(hotelCosts[style]["Mirissa"] / people + 12 * m.food + 8 * m.transport + 12 * m.activity),
      items: [
        { time: "09:00", icon: "🤿", label: "Unawatuna Beach & Snorkeling", detail: "Clear lagoon, reef fish, sea turtles", cost: Math.round(8 * m.activity), category: "activity", tip: "Rent snorkel gear ($3) independently — don't book expensive packages at hotel" },
        { time: "13:00", icon: "🍜", label: "Lunch – Thambapanni beach cafe", detail: "Fresh coconut & beach snacks", cost: Math.round(5 * m.food), category: "meal" },
        { time: "15:00", icon: "🚌", label: "Bus: Unawatuna → Mirissa", detail: "45min coastal highway", cost: Math.round(2 * m.transport), category: "transport", tip: "Local bus costs only $0.50 — same journey as $25 taxi. Just flag down the Matara bus." },
        { time: "17:00", icon: "🌅", label: "Mirissa Coconut Tree Hill", detail: "Famous sunset viewpoint", cost: 0, category: "activity" },
        { time: "20:00", icon: "🦐", label: "Dinner – Mirissa seafood", detail: "Grilled prawns & catch of day", cost: Math.round(12 * m.food), category: "meal" },
        { time: "22:00", icon: "🏨", label: hotelNames[style]["Mirissa"], detail: "Beach paradise check-in", cost: Math.round(hotelCosts[style]["Mirissa"] / people), category: "accommodation" },
      ],
    },
  ];
}

// ─── Route Template Selector ─────────────────────────────────────────────────
function selectRoute(startCity: string, days: number) {
  if (["Kandy"].includes(startCity)) return "hill_country";
  if (["Negombo"].includes(startCity)) return "north_east";
  if (["Galle", "Mirissa", "Unawatuna"].includes(startCity)) return "south_coast";
  return "classic";
}

// ─── Main Generator ──────────────────────────────────────────────────────────
export function generateItinerary(inputs: TripInputs): GeneratedItinerary {
  const { budget, currency, days, people, startCity, travelStyle } = inputs;
  const rate = CURRENCY_RATES[currency];
  const routeKey = selectRoute(startCity, days);
  const route = POPULAR_ROUTES.find((r) => r.key === routeKey) || POPULAR_ROUTES[0];

  let dayPlans: DayPlan[];
  if (routeKey === "south_coast") {
    dayPlans = buildSouthCoastRoute(days, travelStyle, people);
  } else {
    dayPlans = buildClassicRoute(days, travelStyle, people);
  }

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
    routeName: route.name,
    routeSlogan: route.description,
    routeKey,
    cities: route.cities,
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
    highlights: route.highlights,
  };
}
