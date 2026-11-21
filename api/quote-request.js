import { netlifyRoute } from "./_netlify.js";

export const { GET, POST } = netlifyRoute(() => import("../netlify/functions/quote-request.js"));
