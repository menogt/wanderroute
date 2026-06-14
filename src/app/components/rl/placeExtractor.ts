// Extracts a clean, searchable place name from an AI-generated activity label.
// Better queries are the biggest lever on geocoding accuracy.
//
//   "Lunch at Upali's by Nawaloka"  → "Upali's by Nawaloka"
//   "Train: Kandy → Ella"           → null (skip — it's transport)
//   "Temple of the Tooth Relic"     → "Temple of the Tooth Relic"
//   "Hotel"                         → null (too generic to pinpoint)

// Patterns that mean "this isn't a real place — skip it".
const SKIP_PATTERNS = [
  /→/,                                    // transport legs
  /^(bus|train|tuk-?tuk|tuk|taxi|flight|drive|transfer)[\s:]/i,
  /^(check.?in|check.?out|checkout)/i,
  /^(pack|early|free morning|free afternoon|relax|rest|overnight)/i,
  /airport/i,
  /transfer/i,
  /^\d+:\d+/,                             // bare time stamps
];

// Prefixes to strip from meal/activity labels to get the venue name.
const MEAL_PREFIXES = [
  "lunch at ", "lunch – ", "lunch - ", "lunch —",
  "dinner at ", "dinner – ", "dinner - ", "dinner —",
  "breakfast at ", "breakfast – ", "breakfast - ", "breakfast —",
  "dinner ", "lunch ", "breakfast ",
  "sunset cocktails at ", "drinks at ", "coffee at ",
];

// Generic words that geocode to meaningless/random buildings — reject them.
const GENERIC_NAMES = new Set([
  "hotel", "the hotel", "accommodation", "guesthouse", "guest house", "hostel",
  "resort", "lunch", "dinner", "breakfast", "check-in", "checkout", "snacks",
  "drinks", "coffee",
]);

export function extractPlaceName(label: string): string | null {
  const lower = label.toLowerCase().trim();

  // Skip non-places (transport, check-in, free time, etc.)
  if (SKIP_PATTERNS.some(p => p.test(lower))) return null;
  if (label.length < 4) return null;

  // Strip meal/activity prefixes to get the restaurant/venue name.
  for (const prefix of MEAL_PREFIXES) {
    if (lower.startsWith(prefix)) {
      const venue = cleanVenue(label.slice(prefix.length));
      return venue && !GENERIC_NAMES.has(venue.toLowerCase()) ? venue : null;
    }
  }

  // For plain activities, clean up the label directly.
  const cleaned = cleanVenue(label);
  return cleaned && !GENERIC_NAMES.has(cleaned.toLowerCase()) ? cleaned : null;
}

// Remove parentheticals, prices, and trailing descriptors.
function cleanVenue(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")    // (UNESCO), ($30 entry)
    .replace(/\$\d+.*$/, "")    // "$30 entry"
    .replace(/[–—-]\s*.*$/, "") // everything after a dash
    .replace(/,.*$/, "")        // everything after a comma
    .replace(/\s+/g, " ")
    .trim();
}
