import type { DestinationChoice } from "./planningCustomization";

/** One night moved between towns by the route editor's − and + buttons. */
export type NightMove = { from: string; to: string };
export type NightChange = { stops: DestinationChoice[]; message: string; moves: NightMove[] } | { problem: string };

const canGive = (stop: DestinationChoice) => !stop.locked && stop.nights >= 2;

/** The stop with the most nights that can spare one, other than `except`. Later stops win ties. */
function donor(stops: DestinationChoice[], except: number): number {
  let best = -1;
  stops.forEach((stop, index) => {
    if (index === except || !canGive(stop)) return;
    if (best < 0 || stop.nights >= stops[best].nights) best = index;
  });
  return best;
}

/** The unlocked stop with the fewest nights, other than `except`. Ties go to the nearer stop, then the later one. */
function recipient(stops: DestinationChoice[], except: number): number {
  let best = -1;
  stops.forEach((stop, index) => {
    if (index === except || stop.locked) return;
    if (best < 0) { best = index; return; }
    const fewer = stop.nights - stops[best].nights;
    const nearer = Math.abs(index - except) - Math.abs(best - except);
    if (fewer < 0 || (fewer === 0 && (nearer < 0 || (nearer === 0 && index > best)))) best = index;
  });
  return best;
}

/** Latest earlier move matching `match` whose town is still on the route and can take part. */
function lastMove(stops: DestinationChoice[], moves: NightMove[], match: (move: NightMove) => string | undefined,
  usable: (stop: DestinationChoice) => boolean): { move: number; stop: number } | undefined {
  for (let move = moves.length - 1; move >= 0; move--) {
    const city = match(moves[move]);
    if (!city) continue;
    const stop = stops.findIndex(item => item.city === city);
    if (stop >= 0 && usable(stops[stop])) return { move, stop };
  }
  return undefined;
}

function shift(stops: DestinationChoice[], from: number, to: number, moves: NightMove[]): NightChange {
  const next = stops.map(stop => ({ ...stop }));
  next[from].nights -= 1; next[to].nights += 1;
  return { stops: next, moves, message: `Moved a night from ${stops[from].city} to ${stops[to].city}.` };
}

/**
 * One more night in `stops[index]`. If this town gave a night away earlier, it takes that night back;
 * otherwise the night comes from the stop with the most nights.
 */
export function moreNights(stops: DestinationChoice[], index: number, moves: NightMove[] = []): NightChange {
  const city = stops[index].city;
  const back = lastMove(stops, moves, move => move.from === city ? move.to : undefined, canGive);
  if (back && back.stop !== index) return shift(stops, back.stop, index, moves.filter((_, i) => i !== back.move));
  const from = donor(stops, index);
  if (from < 0) return { problem: "Every other stop has one night. Shorten another stop or lengthen the trip in Trip settings." };
  return shift(stops, from, index, [...moves, { from: stops[from].city, to: city }]);
}

/**
 * One night less in `stops[index]`. A night borrowed by an earlier + goes back to the town it came from,
 * so − undoes +; otherwise it goes to the unlocked stop with the fewest nights.
 */
export function fewerNights(stops: DestinationChoice[], index: number, moves: NightMove[] = []): NightChange {
  const city = stops[index].city;
  if (stops[index].nights < 2) return { problem: `${city} has one night. Remove the stop instead.` };
  const back = lastMove(stops, moves, move => move.to === city ? move.from : undefined, stop => !stop.locked);
  if (back && back.stop !== index) return shift(stops, index, back.stop, moves.filter((_, i) => i !== back.move));
  const to = recipient(stops, index);
  if (to < 0) return { problem: stops.length < 2 ? "A one-stop trip keeps all its nights." : "Every other stop is locked, so this night has nowhere to go." };
  return shift(stops, index, to, [...moves, { from: city, to: stops[to].city }]);
}
