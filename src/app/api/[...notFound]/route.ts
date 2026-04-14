// Catch-all for nonexistent /api paths — returns JSON 404 instead of the
// Next.js default HTML fallback (which renders the app shell and confuses
// API clients). Specific route.ts files take precedence over this catch-all.

const body = { error: "Not Found", code: "NOT_FOUND" };
const notFound = () => Response.json(body, { status: 404 });

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
