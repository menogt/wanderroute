export type Screen =
  | "home"
  | "planner"
  | "itinerary"
  | "costs"
  | "routes"
  | "hotels"
  | "share";

export type TravelStyle = "budget" | "comfort" | "luxury";
export type Currency = "USD" | "EUR" | "GBP" | "AUD" | "LKR";
export type Interest =
  | "beaches"
  | "culture"
  | "wildlife"
  | "hiking"
  | "food"
  | "temples"
  | "adventure"
  | "photography";

export type TripInputs = {
  budget: number;
  currency: Currency;
  days: number;
  people: number;
  startCity: string;
  interests: Interest[];
  travelStyle: TravelStyle;
};

export type DayItem = {
  time: string;
  icon: string;
  label: string;
  detail: string;
  cost: number;
  category: "transport" | "activity" | "meal" | "accommodation";
  tip?: string;
  isHidden?: boolean;
};

export type DayPlan = {
  day: number;
  city: string;
  flag: string;
  heroGradient: string;
  accommodation: string;
  accommodationCostPerNight: number;
  items: DayItem[];
  dailyCostPerPerson: number;
  localTip: string;
};

export type CostBreakdown = {
  hotels: number;
  food: number;
  transport: number;
  activities: number;
  entryFees: number;
  misc: number;
};

export type GeneratedItinerary = {
  id: string;
  routeName: string;
  routeSlogan: string;
  routeKey: string;
  cities: string[];
  totalDays: number;
  totalPeople: number;
  currency: Currency;
  estimatedCostPerPerson: number;
  estimatedTotalCost: number;
  inputBudget: number;
  remainingBudget: number;
  budgetStatus: "great" | "ok" | "tight" | "over";
  travelStyle: TravelStyle;
  days: DayPlan[];
  costBreakdown: CostBreakdown;
  globalTips: string[];
  warnings: string[];
  highlights: string[];
};
