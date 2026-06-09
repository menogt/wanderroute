import jsPDF from "jspdf";
import type { GeneratedItinerary } from "./types";
import { CURRENCY_SYMBOLS } from "./data";

// Strip emojis — jsPDF default font can't render them
function e(str: string): string {
  return str.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]|[\u{FE00}-\u{FEFF}]|[\u{1F900}-\u{1F9FF}]|[\u2700-\u27BF]|[\uE000-\uF8FF]/gu, "").trim();
}

const NAVY  = [11, 19, 64] as [number, number, number];
const GOLD  = [201, 162, 39] as [number, number, number];
const TEAL  = [13, 148, 136] as [number, number, number];
const GRAY  = [107, 114, 128] as [number, number, number];
const WHITE = [255, 255, 255] as [number, number, number];
const LIGHT = [243, 244, 246] as [number, number, number];
const GREEN = [16, 185, 129] as [number, number, number];
const RED   = [239, 68, 68] as [number, number, number];
const AMBER = [245, 158, 11] as [number, number, number];
const INDIGO = [99, 102, 241] as [number, number, number];

function fill(doc: jsPDF, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}
function textColor(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}
function drawColor(doc: jsPDF, color: [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}
function rRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, color: [number, number, number]) {
  fill(doc, color);
  doc.roundedRect(x, y, w, h, r, r, "F");
}

export async function downloadItineraryPDF(itinerary: GeneratedItinerary) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const ML = 14;
  const MR = 14;
  const CW = PW - ML - MR;
  const sym = CURRENCY_SYMBOLS[itinerary.currency] ?? "$";
  let y = 0;

  function checkPage(needed: number) {
    if (y + needed > PH - 14) {
      doc.addPage();
      y = 14;
    }
  }

  // ── COVER ────────────────────────────────────────────────────────────────
  fill(doc, NAVY);
  doc.rect(0, 0, PW, 68, "F");
  fill(doc, GOLD);
  doc.rect(0, 64, PW, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  textColor(doc, GOLD);
  doc.text("WANDERROUTE", ML, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  textColor(doc, WHITE);
  const nameLines = doc.splitTextToSize(itinerary.routeName, CW);
  doc.text(nameLines, ML, 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  textColor(doc, GRAY);
  doc.text(itinerary.routeSlogan, ML, 46);

  // chips
  const chips = [`${itinerary.totalDays} days`, `${itinerary.totalPeople} people`, itinerary.travelStyle];
  let cx = ML;
  chips.forEach(chip => {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    const tw = doc.getTextWidth(chip) + 10;
    fill(doc, [29, 53, 96]);
    doc.roundedRect(cx, 54, tw, 7, 2, 2, "F");
    textColor(doc, WHITE);
    doc.text(chip, cx + 5, 59.5);
    cx += tw + 4;
  });

  y = 76;

  // Budget card
  rRect(doc, ML, y, CW, 36, 4, WHITE);
  drawColor(doc, [229, 231, 235]);
  doc.roundedRect(ML, y, CW, 36, 4, 4, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  textColor(doc, GRAY);
  doc.text("ESTIMATED TOTAL COST", ML + 6, y + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  textColor(doc, NAVY);
  doc.text(`${sym}${itinerary.estimatedTotalCost.toLocaleString()}`, ML + 6, y + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  textColor(doc, GRAY);
  doc.text(`/ ${sym}${itinerary.inputBudget.toLocaleString()} budget`, ML + 6 + doc.getTextWidth(`${sym}${itinerary.estimatedTotalCost.toLocaleString()}`) + 3, y + 22);

  const barW = CW - 12;
  const pct = Math.min(1, itinerary.estimatedTotalCost / itinerary.inputBudget);
  const barColor: [number, number, number] = pct > 1 ? RED : pct > 0.85 ? AMBER : GREEN;
  fill(doc, LIGHT);
  doc.roundedRect(ML + 6, y + 26, barW, 4, 2, 2, "F");
  fill(doc, barColor);
  doc.roundedRect(ML + 6, y + 26, barW * pct, 4, 2, 2, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  textColor(doc, GRAY);
  const remaining = itinerary.inputBudget - itinerary.estimatedTotalCost;
  doc.text(remaining >= 0 ? `${sym}${remaining.toLocaleString()} remaining` : "Over budget", ML + 6, y + 34);
  doc.text(`${sym}${itinerary.estimatedCostPerPerson.toLocaleString()} per person`, ML + 6 + barW / 2, y + 34, { align: "center" });

  y += 42;

  // Route flow
  rRect(doc, ML, y, CW, 28, 4, WHITE);
  drawColor(doc, [229, 231, 235]);
  doc.roundedRect(ML, y, CW, 28, 4, 4, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  textColor(doc, GRAY);
  doc.text("YOUR ROUTE", ML + 6, y + 8);

  const cityW = CW / itinerary.cities.length;
  itinerary.cities.forEach((city, i) => {
    const cx2 = ML + i * cityW + cityW / 2;
    const dotColor: [number, number, number] = i === 0 ? GOLD : i === itinerary.cities.length - 1 ? TEAL : NAVY;
    fill(doc, dotColor);
    doc.circle(cx2, y + 17, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    textColor(doc, NAVY);
    doc.text(city, cx2, y + 24, { align: "center" });
    if (i < itinerary.cities.length - 1) {
      drawColor(doc, GOLD);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(cx2 + 3, y + 17, cx2 + cityW - 3, y + 17);
      doc.setLineDashPattern([], 0);
    }
  });

  y += 34;

  // Highlights
  const hlH = 8 + itinerary.highlights.length * 8;
  rRect(doc, ML, y, CW, hlH, 4, [255, 251, 235]);
  drawColor(doc, [253, 230, 138]);
  doc.roundedRect(ML, y, CW, hlH, 4, 4, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  textColor(doc, [146, 64, 14]);
  doc.text("TRIP HIGHLIGHTS", ML + 6, y + 7);
  itinerary.highlights.forEach((h, i) => {
    fill(doc, GOLD);
    doc.circle(ML + 9, y + 13 + i * 8, 1.2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    textColor(doc, [75, 85, 99]);
    doc.text(h, ML + 13, y + 14 + i * 8);
  });
  y += hlH + 4;

  // Cost breakdown
  const bItems = [
    { label: "Accommodation", value: itinerary.costBreakdown.hotels,     color: NAVY },
    { label: "Food & Dining",  value: itinerary.costBreakdown.food,       color: GOLD },
    { label: "Transport",      value: itinerary.costBreakdown.transport,  color: INDIGO },
    { label: "Activities",     value: itinerary.costBreakdown.activities, color: TEAL },
    { label: "Entry Fees",     value: itinerary.costBreakdown.entryFees,  color: AMBER },
    { label: "Miscellaneous",  value: itinerary.costBreakdown.misc,       color: GRAY },
  ];
  const bH = 10 + Math.ceil(bItems.length / 2) * 12;
  checkPage(bH + 4);
  rRect(doc, ML, y, CW, bH, 4, WHITE);
  drawColor(doc, [229, 231, 235]);
  doc.roundedRect(ML, y, CW, bH, 4, 4, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  textColor(doc, GRAY);
  doc.text("COST BREAKDOWN", ML + 6, y + 7);
  bItems.forEach((item, i) => {
    const bx = i % 2 === 0 ? ML + 6 : ML + CW / 2 + 4;
    const by = y + 12 + Math.floor(i / 2) * 12;
    fill(doc, item.color);
    doc.rect(bx, by + 1, 3, 6, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    textColor(doc, [75, 85, 99]);
    doc.text(item.label, bx + 6, by + 6);
    doc.setFont("helvetica", "bold");
    textColor(doc, NAVY);
    doc.text(`${sym}${item.value.toLocaleString()}`, bx + 76, by + 6, { align: "right" });
  });
  y += bH + 4;

  // ── DAY PAGES ─────────────────────────────────────────────────────────────
  itinerary.days.forEach((day) => {
    doc.addPage();
    y = 0;

    fill(doc, NAVY);
    doc.rect(0, 0, PW, 26, "F");
    fill(doc, GOLD);
    doc.rect(0, 22, PW, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    textColor(doc, GRAY);
    doc.text(`DAY ${day.day}  ·  WANDERROUTE`, ML, 11);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    textColor(doc, WHITE);
    doc.text(e(`${day.flag}  ${day.city}`), ML, 20);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    textColor(doc, GOLD);
    doc.text(`${sym}${day.dailyCostPerPerson}/person`, PW - MR, 20, { align: "right" });

    y = 32;

    rRect(doc, ML, y, CW, 10, 3, LIGHT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    textColor(doc, NAVY);
    doc.text(e(`${day.accommodation}  ·  ${sym}${day.accommodationCostPerNight}/night`), ML + 6, y + 6.5);
    y += 14;

    day.items.forEach((item) => {
      checkPage(22);
      const catColor: [number, number, number] =
        item.category === "transport" ? INDIGO
        : item.category === "meal" ? AMBER
        : item.category === "accommodation" ? NAVY
        : TEAL;

      rRect(doc, ML, y, CW, 18, 3, WHITE);
      drawColor(doc, LIGHT);
      doc.roundedRect(ML, y, CW, 18, 3, 3, "S");

      fill(doc, catColor);
      doc.rect(ML, y, 3, 18, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      textColor(doc, GRAY);
      doc.text(item.time, ML + 6, y + 7);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      textColor(doc, NAVY);
      doc.text(e(`${item.icon}  ${item.label}`), ML + 22, y + 7);

      const costStr = item.cost === 0 ? "FREE" : `${sym}${item.cost}`;
      textColor(doc, item.cost === 0 ? GREEN : NAVY);
      doc.text(costStr, PW - MR, y + 7, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      textColor(doc, GRAY);
      const detailLines = doc.splitTextToSize(item.detail, CW - 28);
      doc.text(detailLines[0], ML + 22, y + 14);
      y += 20;

      if (item.tip) {
        checkPage(14);
        rRect(doc, ML + 3, y, CW - 6, 10, 2, [255, 251, 235]);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        textColor(doc, [146, 64, 14]);
        const tipLine = doc.splitTextToSize(e(`  ${item.tip}`), CW - 16);
        doc.text(tipLine[0], ML + 8, y + 6.5);
        y += 12;
      }
    });

    if (day.localTip) {
      checkPage(18);
      y += 4;
      rRect(doc, ML, y, CW, 14, 3, [230, 250, 248]);
      drawColor(doc, [153, 221, 214]);
      doc.roundedRect(ML, y, CW, 14, 3, 3, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      textColor(doc, TEAL);
      doc.text("LOCAL TIP", ML + 6, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      textColor(doc, [55, 65, 81]);
      const ltLines = doc.splitTextToSize(day.localTip, CW - 14);
      doc.text(ltLines[0], ML + 6, y + 11);
      y += 18;
    }
  });

  // ── TIPS PAGE ─────────────────────────────────────────────────────────────
  doc.addPage();
  y = 0;
  fill(doc, NAVY);
  doc.rect(0, 0, PW, 20, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  textColor(doc, WHITE);
  doc.text("Money-Saving Tips", ML, 14);
  fill(doc, GOLD);
  doc.rect(0, 18, PW, 2, "F");
  y = 26;

  itinerary.globalTips.forEach((tip, i) => {
    checkPage(18);
    rRect(doc, ML, y, CW, 14, 3, WHITE);
    drawColor(doc, [229, 231, 235]);
    doc.roundedRect(ML, y, CW, 14, 3, 3, "S");
    rRect(doc, ML + 4, y + 3, 7, 7, 2, GOLD);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    textColor(doc, NAVY);
    doc.text(String(i + 1).padStart(2, "0"), ML + 5.5, y + 8.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    textColor(doc, [55, 65, 81]);
    const tipLines = doc.splitTextToSize(tip, CW - 20);
    doc.text(tipLines[0], ML + 15, y + 8.5);
    y += 17;
  });

  if (itinerary.warnings?.length > 0) {
    y += 4;
    checkPage(20);
    rRect(doc, ML, y, CW, 10, 3, [254, 242, 242]);
    drawColor(doc, [252, 165, 165]);
    doc.roundedRect(ML, y, CW, 10, 3, 3, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    textColor(doc, RED);
    doc.text("Watch Out For", ML + 6, y + 6.5);
    y += 12;
    itinerary.warnings.forEach((w) => {
      checkPage(12);
      fill(doc, RED);
      doc.circle(ML + 5, y + 2, 1.2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      textColor(doc, [75, 85, 99]);
      const wLines = doc.splitTextToSize(w, CW - 12);
      doc.text(wLines[0], ML + 10, y + 4);
      y += 10;
    });
  }

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    fill(doc, NAVY);
    doc.rect(0, PH - 10, PW, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    textColor(doc, GRAY);
    doc.text("wanderroute.netlify.app", ML, PH - 4);
    doc.text(`Page ${p} of ${totalPages}`, PW / 2, PH - 4, { align: "center" });
    doc.text(`Generated ${new Date().toLocaleDateString()}`, PW - MR, PH - 4, { align: "right" });
  }

  doc.save(`WanderRoute-${itinerary.routeName.replace(/\s+/g, "-")}.pdf`);
}