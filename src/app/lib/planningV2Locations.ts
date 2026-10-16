import type { MatrixLocation } from "./travelTimeMatrix";

/** AIP VCBI AD 2.2 airport reference point: 071048.68N 0795307.08E.
 * https://www.airport.lk/aasl/AIS/AMDT%20WEB/AIP%20FROM%2021%20MAR%202024/PDF/VCBI%20AD%202-1%20TO%202-95.pdf
 * This is a geographic routing endpoint, never a sightseeing destination.
 */
export const CMB_AIRPORT: MatrixLocation = {
  id: "CMB_AIRPORT",
  name: "Bandaranaike International Airport (CMB)",
  coordinates: { latitude: 7 + 10 / 60 + 48.68 / 3600, longitude: 79 + 53 / 60 + 7.08 / 3600 },
};

export function resolvePlanningEndpoint(location: string): MatrixLocation | undefined {
  const key = location.trim().toLowerCase();
  if (["cmb", "cmb_airport", "vcbi", "bandaranaike international airport",
    CMB_AIRPORT.name.toLowerCase()].includes(key)) return CMB_AIRPORT;
  return undefined;
}
