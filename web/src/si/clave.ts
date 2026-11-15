/**
 * Gemini key for the SI guide: intentionally empty in the repository.
 *
 * The key is a Google Cloud credential and must never be published. Two ways to give it:
 * - published site: the TERRA-X server keeps it in TERRAX_GEMINI_KEY and relays the chat
 *   (servidor/si.py, POST /api/si/chat), so it never reaches the browser;
 * - local development: put VITE_GEMINI_API_KEY=... in web/.env.development.local (git-ignored, dev server only).
 * With neither, the guide answers from the candidate card only, and says so.
 */
export const CLAVE_GEMINI = "";
