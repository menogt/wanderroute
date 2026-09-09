// Monsoon seasons by region. Pure data: no imports, no logic.
//
// Months are 1-12 (January = 1). A city maps to one region; a region lists the
// months to avoid, the months that deserve caution, the months that are best,
// and which cities on the opposite coast to suggest instead.

export type SeasonRegion = "South & West" | "East & North" | "Hill Country" | "Cultural Triangle";

export type RegionSeason = {
  /** Short label used in the banner, e.g. "the south-west monsoon". */
  weather: string;
  avoid: number[];
  caution: number[];
  best: number[];
  /** Cities on the opposite coast that are in season when this region is not. */
  alternatives: string[];
};

export const REGION_SEASONS: Record<SeasonRegion, RegionSeason> = {
  "South & West": {
    weather: "the south-west monsoon",
    avoid: [5, 6, 7, 8, 9],
    caution: [4, 10],
    best: [12, 1, 2, 3],
    alternatives: ["Arugam Bay", "Trincomalee"],
  },
  "East & North": {
    weather: "the north-east monsoon",
    avoid: [11, 12, 1, 2],
    caution: [3, 4, 10],
    best: [5, 6, 7, 8, 9],
    alternatives: ["Mirissa", "Galle"],
  },
  "Hill Country": {
    weather: "the wettest months in the hills",
    avoid: [],
    caution: [6, 7, 8],
    best: [1, 2, 3, 4],
    alternatives: ["Trincomalee", "Arugam Bay"],
  },
  "Cultural Triangle": {
    weather: "the inter-monsoon rains",
    avoid: [],
    caution: [10, 11, 12],
    best: [5, 6, 7, 8, 9],
    alternatives: ["Galle", "Mirissa"],
  },
};

// Keys are lower-case so lookups can be case-insensitive. Includes every name
// the city picker, the map, and older saved trips can produce, plus the wider
// list of coastal towns so a hand-typed city still matches.
export const CITY_REGIONS: Record<string, SeasonRegion> = {
  // South & West
  galle: "South & West",
  unawatuna: "South & West",
  mirissa: "South & West",
  weligama: "South & West",
  ahangama: "South & West",
  hikkaduwa: "South & West",
  bentota: "South & West",
  tangalle: "South & West",
  negombo: "South & West",
  colombo: "South & West",
  kalpitiya: "South & West",
  yala: "South & West",
  tissamaharama: "South & West",
  "tissamaharama/yala": "South & West",

  // East & North
  trincomalee: "East & North",
  nilaveli: "East & North",
  uppuveli: "East & North",
  "arugam bay": "East & North",
  pasikuda: "East & North",
  kalkudah: "East & North",
  batticaloa: "East & North",
  jaffna: "East & North",

  // Hill Country
  "nuwara eliya": "Hill Country",
  ella: "Hill Country",
  haputale: "Hill Country",
  kandy: "Hill Country",

  // Cultural Triangle
  sigiriya: "Cultural Triangle",
  dambulla: "Cultural Triangle",
  anuradhapura: "Cultural Triangle",
  polonnaruwa: "Cultural Triangle",
  habarana: "Cultural Triangle",
  minneriya: "Cultural Triangle",
};

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
