import { jsPDF } from "jspdf";
import { PDF_COASTLINE } from "./pdfCoastline.ts";
import { planningMoney, type PlanningPresentation } from "./planningPresentation.ts";

export type PlanningPDFFonts = { regular: string; bold: string };
export async function loadPlanningPDFFonts(): Promise<PlanningPDFFonts> {
  const files = await Promise.all(["Vera.ttf", "VeraBd.ttf"].map(async name => {
    const response = await fetch(`/pdf/${name}`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("PDF fonts could not be loaded. Please retry while online.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }));
  return { regular: files[0], bold: files[1] };
}

const NAVY = "#071A2D", IVORY = "#FFF9EF", GOLD = "#D4A64A", MUTED = "#596775", GREEN = "#4F6F52";

/** Pure export of a captured current-plan snapshot. No network, AI, map tiles or price inference. */
export function createPlanningPDF(plan: PlanningPresentation, fonts: PlanningPDFFonts, approved = false): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS("Vera.ttf", fonts.regular); doc.addFont("Vera.ttf", "Vera", "normal");
  doc.addFileToVFS("VeraBd.ttf", fonts.bold); doc.addFont("VeraBd.ttf", "Vera", "bold");
  doc.setFont("Vera");
  const font = doc.getFont() as unknown as { metadata: { characterToGlyph: (code: number) => number } };
  const missing = new Set<string>();
  const clean = (value: string) => Array.from(String(value).replace(/[\u2010-\u2015]/g, "-").replace(/\t/g, " "))
    .map(char => char === "\n" || font.metadata.characterToGlyph(char.codePointAt(0)!) ? char : (() => {
      const code = `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`; missing.add(code); return `[${code}]`;
    })()).join("");
  let y = 0, section = "Your Sri Lanka journey";
  const width = 174, bottom = 272;
  const money = (n: number) => planningMoney(n, plan.brief.budget.currency);
  const page = (title = section, add = true) => {
    if (add) doc.addPage();
    doc.setFillColor(IVORY); doc.rect(0, 0, 210, 297, "F");
    doc.setFont("Vera", "bold"); doc.setFontSize(8); doc.setTextColor(GREEN);
    doc.text("WANDERROUTE / SRI LANKA", 18, 17);
    doc.setDrawColor(GOLD); doc.setLineWidth(.4); doc.line(18, 22, 192, 22);
    doc.setFont("times", "normal"); doc.setFontSize(25); doc.setTextColor(NAVY); doc.text(title, 18, 35);
    y = 44;
  };
  const ensure = (height: number) => { if (y + height > bottom) page(`${section} / continued`); };
  const text = (value: string, size = 10, bold = false, color = NAVY, indent = 0) => {
    doc.setFont("Vera", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(color);
    const lines: string[] = doc.splitTextToSize(clean(value), width - indent);
    const leading = size * .352778 * 1.5;
    for (const line of lines) {
      ensure(leading);
      // ensure() may have drawn a new page heading with a different font.
      doc.setFont("Vera", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(doc.getNumberOfPages() > 1 && color === IVORY ? NAVY : color);
      doc.text(line, 18 + indent, y); y += leading;
    }
    y += 2;
  };
  const rule = () => { ensure(6); doc.setDrawColor("#D8DDE0"); doc.line(18, y, 192, y); y += 6; };
  const heading = (value: string) => { ensure(22); text(value, 14, true); };
  const begin = (name: string) => { section = name; page(); };

  doc.setFillColor(NAVY); doc.rect(0, 0, 210, 297, "F");
  doc.setFont("Vera", "bold"); doc.setFontSize(9); doc.setTextColor(GOLD); doc.text("WANDERROUTE / SRI LANKA", 18, 23);
  y = 48; doc.setFont("times", "normal"); doc.setFontSize(30); doc.setTextColor(IVORY); doc.text("A journey of your own", 18, y); y += 15;
  text(plan.title, 19, false, IVORY);
  y += 10;
  text(`${plan.brief.durationDays} days / ${plan.brief.durationDays - 1} nights / ${plan.brief.travellerCount} travellers`, 12, true, IVORY);
  text(`${plan.days[0]?.date ?? "Start date to confirm"} to ${plan.days[plan.days.length - 1]?.date ?? "End date to confirm"}`, 11, false, IVORY);
  text(`Plan reference ${plan.reference}`, 9, false, GOLD);
  text(approved ? "Your preferred draft" : "Working draft", 11, true, IVORY);
  text("Not a booking confirmation. No reservations or payments are made by this document.", 10, false, IVORY);
  text(plan.generationMode === "LIMITED_DRAFT" ? "Limited draft: prepared from available place records. Real AI suggestions were not available for this draft." : "Activity suggestions checked against available place records; arrangements still need confirmation.", 9, false, IVORY);
  y += 7;
  for (const stop of plan.route) text(`${stop.name} / ${stop.nights} ${stop.nights === 1 ? "night" : "nights"}`, 11, false, IVORY);
  if (plan.conflicts.length) { y += 3; text("Conflicts to resolve - see preparation and checks", 10, true, GOLD); }

  begin("Your route at a glance");
  text("Geographical overview. Dotted connections show visit order, not roads or measured travel times.", 9, false, MUTED);
  const mapTop = y + 2, mapHeight = 112;
  doc.setFillColor("#EDF2F0"); doc.roundedRect(18, mapTop, width, mapHeight, 2, 2, "F");
  const cos = Math.cos(7.8 * Math.PI / 180), scale = 23;
  const point = (lon: number, lat: number): [number, number] => [69 + (lon - 79.38) * cos * scale, mapTop + 7 + (10.04 - lat) * scale];
  doc.setFillColor("#D6DFD0"); doc.setDrawColor("#9DAEAA"); doc.setLineWidth(.2);
  for (const ring of PDF_COASTLINE) {
    const coords = ring.map(([lon, lat]) => point(lon, lat));
    const start = coords[0], relative = coords.slice(1).map((value, i) => [value[0] - coords[i][0], value[1] - coords[i][1]]);
    doc.lines(relative, start[0], start[1], [1, 1], "FD", true);
  }
  const orderedRoute = plan.days.flatMap((day, index) => [
    ...(index === 0 || plan.days[index - 1].city !== day.city ? [plan.route.find(stop => stop.name === day.city)] : []),
    ...(day.visitCity ? [plan.visits.find(visit => visit.day === day.day), plan.route.find(stop => stop.name === day.city)] : []),
  ]).filter(Boolean).map(stop => ({ ...stop, label: stop.name,
    ...(plan.route.some(base => base.name === stop.name) ? { number: plan.route.findIndex(base => base.name === stop.name) + 1 } : {}) }));
  const markers = [plan.endpoints[0], ...orderedRoute, plan.endpoints[1]];
  const mapped = markers.map(marker => {
    const coords = marker.coordinates;
    const p = coords && coords.latitude >= 5.6 && coords.latitude <= 10.1 && coords.longitude >= 79.3 && coords.longitude <= 82.2
      ? point(coords.longitude, coords.latitude) : undefined;
    return { marker, p };
  });
  let previous: [number, number] | undefined;
  for (const { p } of mapped) {
    if (p && previous) { doc.setLineDashPattern([1, 1], 0); doc.setDrawColor(GOLD); doc.setLineWidth(.8); doc.line(...previous, ...p); doc.setLineDashPattern([], 0); }
    previous = p;
  }
  const drawn = new Set<string>();
  for (const { marker, p } of mapped) {
    if (!p) continue;
    const key = `${p.join(",")}:${"number" in marker ? marker.number : marker.label}`;
    if (drawn.has(key)) continue;
    drawn.add(key);
    doc.setFillColor("number" in marker ? NAVY : GOLD); doc.circle(p[0], p[1], "number" in marker ? 2.8 : 1.8, "F");
    if ("number" in marker) { doc.setFont("Vera", "bold"); doc.setFontSize(7); doc.setTextColor(IVORY); doc.text(String(marker.number), p[0], p[1] + .9, { align: "center" }); }
  }
  doc.setFont("Vera"); doc.setFontSize(7); doc.setTextColor(MUTED); doc.text("N", 180, mapTop + 9); doc.text("Made with Natural Earth / public domain", 22, mapTop + mapHeight - 4);
  y = mapTop + mapHeight + 9;
  for (const [index, stop] of plan.route.entries()) text(`${index + 1}. ${stop.name} - ${stop.nights} nights`, 11, true);
  for (const visit of plan.visits) text(`Day ${visit.day}: ${visit.name} visit / return to ${visit.base}. Services need confirmation.`, 9);
  for (const endpoint of plan.endpoints) text(`${endpoint.kind === "arrival" ? "Arrival" : "Departure"}: ${endpoint.label} / ${endpoint.localDateTime?.replace("T", " ") ?? "local time to confirm"}`, 9);
  text("Missing coordinates are omitted from this overview. Country outline and city markers are not navigation instructions.", 8, false, MUTED);

  begin("Your days in Sri Lanka");
  for (const day of plan.days) {
    ensure(60); rule(); heading(`Day ${String(day.day).padStart(2, "0")} / ${day.visitCity ? `${day.visitCity} (from ${day.city})` : day.city}`);
    text(`${day.date ?? "Date to confirm"} / ${day.overnightCity ? `Overnight in ${day.overnightCity}` : "Final travel day"}`, 9, true, GREEN);
    for (const item of day.items) {
      ensure(25); text(`${item.time}${item.end ? ` to ${item.end}` : ""} / ${item.label}`, 10, true);
      text(item.detail, 9);
      text(`${item.duration ? `${item.duration} min ${item.category === "transport" ? "transfer estimate" : "visit estimate"} / ` : ""}${item.cost}`, 8, false, MUTED);
    }
    if (day.overnightCity) { text(`Stay: ${day.stay}${day.rooms ? ` / ${day.rooms} rooms requested; occupancy to check` : " / room requirements to confirm"}`, 9, true); text(day.stayStatus, 8, false, MUTED); }
    text(day.note, 9);
    if (day.warnings.length) text(`Check before travel: ${day.warnings.join("; ")}`, 8, false, MUTED);
    y += 5;
  }

  begin("Stays and transfers");
  for (const stop of plan.route) {
    heading(`${stop.name} / ${stop.nights} nights`);
    text(stop.stay?.name || stop.stay?.area || "Property / area to choose", 10);
    text(`${stop.status}. ${stop.stay?.rooms ? `${stop.stay.rooms} rooms requested; occupancy unconfirmed.` : "Room count and occupancy to confirm."}`, 9);
    if (stop.stay?.notes) text(stop.stay.notes, 9);
  }
  for (const transfer of plan.transfers) {
    rule(); text(`${transfer.from} to ${transfer.to}`, 11, true); text(`${transfer.mode} / ${transfer.timing}`, 9); text(transfer.status, 8, false, MUTED);
  }
  if (!plan.transfers.length) text("No intercity transfer in this route. Local transport still needs arranging.", 9);

  begin("Your travel budget");
  text(`Your target: ${money(plan.brief.budget.amount)} for the whole party`, 12, true);
  text(plan.budget.supported > 0 ? `Supported / recorded subtotal: ${money(plan.budget.supported)}. Additional unpriced costs remain.` : "No supported whole-trip price is available. Unknown costs are not zero.", 10);
  for (const row of plan.budget.rows) {
    ensure(24); rule(); text(row.label, 10, true);
    text(`${!row.lineCount ? "Not included in listed plan; budget separately if needed" : row.supported || !row.gaps ? `Supported: ${money(row.supported)}${row.supportedMaximum !== row.supported ? ` to ${money(row.supportedMaximum)}` : ""}` : "Price to confirm"}${row.gaps ? "; additional costs need pricing" : ""}`, 9);
    if (row.allowance) text(`Your additional allowance: ${row.allowanceTotal === undefined ? "Incomplete; enter room quantity" : money(row.allowanceTotal)} (${row.allowance.amount} ${plan.brief.budget.currency}, ${row.allowance.basis.toLowerCase().replace(/_/g, " ")}${row.allowance.rooms ? `, ${row.allowance.rooms} rooms` : ""}). A personal planning assumption, not a market rate or quote.`, 8, false, MUTED);
  }
  if (plan.budget.rows.some(row => row.allowance)) {
    rule(); text(`Your scenario: ${money(plan.budget.scenarioMinimum)}${plan.budget.scenarioMaximum !== plan.budget.scenarioMinimum ? ` to ${money(plan.budget.scenarioMaximum)}` : ""}`, 12, true);
    text(`Supported amounts plus your allowances / ${money(plan.budget.scenarioMinimum / plan.brief.travellerCount)} per traveller before uncovered costs.`, 9);
  }
  if (plan.budget.uncovered.length) text(`Still unpriced: ${plan.budget.uncovered.join(", ")}`, 9);
  text(`Excluded: ${plan.budget.exclusions.join("; ")}.`, 9);
  heading("Price evidence and assumptions");
  for (const line of plan.costLines.filter(line => line.provenance)) {
    text(`${line.day ? `Day ${line.day}: ` : ""}${line.label} / ${line.amount}`, 9, true);
    text(`${line.quantity} ${line.basis.toLowerCase().replace(/_/g, " ")}${line.periodCount ? ` x ${line.periodCount} ${line.periodUnit?.toLowerCase()}` : ""}. ${line.provenance!.status}. Source: ${line.provenance!.source ?? "Source to confirm"}. Checked: ${line.provenance!.checkedAt ?? "Date not supplied"}.${line.provenance!.note ? ` ${line.provenance!.note}` : ""}`, 8, false, MUTED);
    if (line.conversion) text(`Conversion: 1 ${line.conversion.from} = ${line.conversion.rate} ${line.conversion.to}; ${line.conversion.source ?? "source to confirm"}, ${line.conversion.checkedAt ?? "date to confirm"}.`, 8);
  }

  begin("Prepare for your journey");
  if (plan.conflicts.length) { heading("Resolve before relying on this plan"); for (const issue of plan.conflicts) text(`- ${issue}`, 10, true); }
  heading("Your remaining arrangements");
  for (const step of plan.preparation) text(`- ${step}`, 10);
  if (plan.brief.travellerNotes) { heading("Your travel notes"); text(plan.brief.travellerNotes, 10); }
  if (plan.unscheduled.length || plan.requestedVisits.length) {
    heading("Choices still to schedule");
    for (const item of plan.unscheduled) text(`${item.label} / ${item.city} / not scheduled`, 9);
    for (const visit of plan.requestedVisits) text(`${visit.city} / ${visit.requirement === "MUST" ? "must visit" : "optional"} / ${visit.day ? `planned return visit on day ${visit.day}; services need confirmation` : "visit request, not scheduled"}`, 9);
  }
  if (plan.season.length) { heading("Seasonal context"); text(plan.season.join("; "), 9); }
  heading("Plan checks"); for (const issue of plan.checks) text(`- ${issue}`, 8, false, MUTED);
  heading("Sources and use");
  text("Place records and the WanderRoute landmark guide provide suggestions, not verified availability or opening hours. Confirm current information directly with the provider. OSRM car-road routing, where present, supplies driving estimates only. This plan has no live disruption monitoring.", 8, false, MUTED);
  text("PDF overview: Natural Earth 1:50m, public domain (naturalearthdata.com/about/terms-of-use/). No website map tiles were exported. Typeface: Bitstream Vera, copyright 2003 Bitstream, Inc.; bundled license at wanderroute.netlify.app/pdf/bitstream-vera-license.txt.", 8, false, MUTED);
  if (missing.size) text(`Some characters are outside this PDF font's coverage. They are preserved as Unicode codes in brackets: ${[...missing].join(", ")}. Read the full original text in the website itinerary.`, 8, false, MUTED);
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i); doc.setTextColor(i === 1 ? IVORY : MUTED); doc.setFont("Vera"); doc.setFontSize(7);
    doc.setDrawColor(GOLD); doc.line(18, 281, 192, 281);
    doc.text(`DRAFT / not a booking confirmation / ${plan.reference}`, 18, 287); doc.text(`${i} / ${total}`, 192, 287, { align: "right" });
  }
  doc.setProperties({ title: `WanderRoute - ${plan.title}`, subject: "Current travel draft; not a booking confirmation", author: "WanderRoute", keywords: "Sri Lanka, travel itinerary, draft" });
  return doc;
}
