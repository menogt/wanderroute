import { netlifyRoute } from "./_netlify.js";

export const { GET, POST } = netlifyRoute(() => import("../netlify/functions/generate-v2-itinerary.js"));
