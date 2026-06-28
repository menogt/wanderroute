// Affiliate IDs from environment — links work without them, just untracked
const BOOKING_AID = import.meta.env.VITE_BOOKING_AFFILIATE_ID?.trim() || "";
const AGODA_CID = import.meta.env.VITE_AGODA_CID?.trim() || "";

// Build a Booking.com affiliate link for a hotel
export function bookingLink(
  hotelName: string,
  city: string,
  checkIn?: string,
  checkOut?: string,
  existingUrl?: string
): string {
  let url: URL;

  if (existingUrl) {
    try {
      url = new URL(existingUrl);
    } catch {
      url = new URL("https://www.booking.com/search.html");
      url.searchParams.set("ss", `${hotelName} ${city} Sri Lanka`);
    }
  } else {
    url = new URL("https://www.booking.com/search.html");
    url.searchParams.set("ss", `${hotelName} ${city} Sri Lanka`);
  }

  // Affiliate tracking
  if (BOOKING_AID) url.searchParams.set("aid", BOOKING_AID);

  // Dates
  if (checkIn) url.searchParams.set("checkin", checkIn);
  if (checkOut) url.searchParams.set("checkout", checkOut);

  return url.toString();
}

// Build an Agoda affiliate link for a hotel
export function agodaLink(
  hotelName: string,
  city: string,
  existingUrl?: string
): string {
  let url: URL;

  if (existingUrl) {
    try {
      url = new URL(existingUrl);
    } catch {
      url = new URL("https://www.agoda.com/search");
      url.searchParams.set("q", `${hotelName} ${city} Sri Lanka`);
    }
  } else {
    url = new URL("https://www.agoda.com/search");
    url.searchParams.set("q", `${hotelName} ${city} Sri Lanka`);
  }

  if (AGODA_CID) url.searchParams.set("cid", AGODA_CID);

  return url.toString();
}

// Whether Agoda links should be shown (only if we have a CID, or always show)
export const AGODA_ENABLED = true; // show Agoda button on every card
