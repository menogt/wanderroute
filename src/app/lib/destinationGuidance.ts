import { matrixLeg, type TravelMatrix } from "./travelTimeMatrix.ts";

export function destinationHint(cities: string[], days?: number) {
  const has = (city: string) => cities.includes(city);
  if (has("Sigiriya") && has("Dambulla")) return {
    text: "You could keep one hotel for Sigiriya and Dambulla and visit the other as a day trip.",
    source: "https://www.visitmysrilanka.lk/classic-sri-lanka-8-days/" };
  const east = cities.find(city => ["Trincomalee", "Arugam Bay"].includes(city));
  const south = cities.find(city => ["Mirissa", "Galle", "Hikkaduwa"].includes(city));
  if (east && south && days && days <= 7) return {
    text: `With ${days} days, compare time on the road between ${east} and ${south} with an extra night on one coast.`,
    source: "https://www.onesrilanka.lk/guides/sri-lanka-7-day-itinerary" };
  if (cities.length >= 2 && cities.every(city => ["Galle", "Mirissa", "Hikkaduwa", "Bentota"].includes(city))) return {
    text: "A coast-only trip can work well. You can stay by the sea and retrace part of the coastal route for your return transfer.",
    source: "https://www.aman.com/sites/default/files/2024-01/Aman_Sri_Lanka_Sample_itineraries_7N_Fort_and_Beach_Journey.pdf" };
  if (has("Ella") && has("Kandy") && south) return {
    text: `One published pattern links Kandy and Ella before a coastal stay. Compare finishing near ${south} with doing the coast first.`,
    source: "https://www.srilankaholidaystours.com/packages/14-day-sri-lanka-tour-package-sigiriya-kandy-ella-yala-galle" };
  if (has("Kandy") && has("Ella") && !south) return {
    text: "Kandy and Ella can form the hill-country part of a trip. If you also want beach time, compare a southern stop after Ella with keeping that night in the hills.",
    source: "https://www.roughguides.com/sri-lanka/itineraries/7-days-in-sri-lanka-itinerary/" };
  if (has("Trincomalee") && has("Sigiriya")) return {
    text: "Sigiriya and Trincomalee can share an inland-and-east-coast journey. You can spend your beach nights in the east and skip a separate south-coast leg.",
    source: "https://ceyroutes.com/itineraries/east-coast-sri-lanka" };
}

export function compareStopOrders(stops: string[], start: string, end: string, matrix: TravelMatrix) {
  if (stops.length < 2 || stops.length > 8 || matrix.source !== "OSRM_TABLE") return;
  function driving(order: string[]) {
    const route = [start, ...order, end];
    let total = 0;
    for (let index = 1; index < route.length; index++) {
      if (route[index - 1] === route[index]) continue;
      const leg = matrixLeg(matrix, route[index - 1], route[index]);
      if (leg?.durationMinutes === undefined || !["ROUTED", "PARTIAL"].includes(leg.status)) return;
      total += leg.durationMinutes;
    }
    return total;
  }
  const original = driving(stops);
  if (original === undefined) return;
  let best = { order: stops, minutes: original };
  const candidates = [[...stops].reverse()];
  for (const city of stops) {
    for (let index = 0; index < stops.length; index++) {
      const order = stops.filter(stop => stop !== city);
      order.splice(index, 0, city);
      candidates.push(order);
    }
  }
  for (const order of candidates) {
    const minutes = driving(order);
    if (minutes !== undefined && minutes < best.minutes) best = { order, minutes };
  }
  const saving = original - best.minutes;
  const finalStop = stops[stops.length - 1];
  const finalDrive = finalStop === end ? 0 : matrixLeg(matrix, finalStop, end)?.durationMinutes;
  return { original, finalDrive, alternative: saving >= Math.max(30, original * 0.1) ? best : undefined };
}
