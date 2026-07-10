// Hand-picked "must-see" landmarks per city.
//
// Why this exists: the 4,742 places imported from OSM (scripts/importPlaces.mjs)
// have no crowd ratings, and OSM tagging quality varies — some genuinely famous
// sites are thinly tagged or missing entirely, while minor spots are well-tagged.
// This list guarantees the AI itinerary prompt always includes the landmarks a
// tourist would actually expect, regardless of what the database returns.
//
// Keep it SHORT and iconic (3-6 entries per city) — this is a "don't miss this"
// list, not a comprehensive attractions list. The database + importance_score
// (see importPlaces.mjs) handles everything beyond these highlights.
//
// To edit: just add/remove names below. Names don't need to exactly match OSM
// data — they're injected directly into the AI prompt as text, not matched
// against the places table.
export const MUST_SEE: Record<string, string[]> = {
  Colombo: [
    "Gangaramaya Temple",
    "Galle Face Green",
    "Independence Square",
    "National Museum of Colombo",
  ],
  Kandy: [
    "Temple of the Sacred Tooth Relic",
    "Kandy Lake",
    "Royal Botanical Gardens Peradeniya",
    "Kandy Cultural Dance Show",
  ],
  Ella: [
    "Nine Arches Bridge",
    "Little Adam's Peak",
    "Ella Rock",
    "Ravana Falls",
  ],
  Galle: [
    "Galle Fort",
    "Galle Lighthouse",
    "Jungle Beach",
  ],
  Mirissa: [
    "Mirissa Beach",
    "Whale Watching Mirissa",
    "Coconut Tree Hill",
  ],
  Sigiriya: [
    "Sigiriya Rock Fortress",
    "Pidurangala Rock",
    "Sigiriya Museum",
  ],
  Negombo: [
    "Negombo Beach",
    "Negombo Fish Market",
    "Angurukaramulla Temple",
  ],
  "Nuwara Eliya": [
    "Gregory Lake",
    "Pedro Tea Estate",
    "Horton Plains National Park",
  ],
  Dambulla: [
    "Dambulla Cave Temple",
  ],
  Trincomalee: [
    "Koneswaram Temple",
    "Pigeon Island National Park",
    "Nilaveli Beach",
  ],
  Hikkaduwa: [
    "Hikkaduwa Coral Reef",
    "Hikkaduwa Beach",
  ],
  "Arugam Bay": [
    "Arugam Bay Beach",
    "Pottuvil Point",
    "Kumana National Park",
  ],
};
