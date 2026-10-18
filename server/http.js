import { timingSafeEqual } from 'node:crypto';

// Request plumbing shared by every /api function: auth, JSON parsing, error responses.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MAX_BODY_BYTES = 10_000;

const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function readJsonBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'Request too large');
  if (!text) return {};
  try {
    const body = JSON.parse(text);
    if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  } catch { /* fall through */ }
  throw new HttpError(400, 'Request body must be a JSON object');
}

// The browser sends the Supabase access token as a bearer token; Supabase verifies it.
// (Bearer tokens aren't sent automatically like cookies, so cross-site request forgery doesn't apply.)
async function authenticate(request, auth) {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new HttpError(401, 'Sign in first');
  const { data, error } = await auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Your session expired — sign in again');
  return data.user;
}

// Only HttpError messages reach the client; anything else is logged and hidden.
function failure(err) {
  if (err instanceof HttpError) return json(err.status, { error: err.message });
  console.error(err);
  return json(500, { error: 'Something went wrong — try again later' });
}

const sameSecret = (given, expected) => {
  const a = Buffer.from(given ?? '');
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Wraps a POST handler for scheduled jobs: (services) => result. The caller must send the
 * secret in env var `secretName` as a bearer token; without that env var the endpoint is off.
 */
export function cronPost(secretName, getServices, handler) {
  return async (request) => {
    try {
      const secret = process.env[secretName];
      if (!secret || secret.length < 32) throw new HttpError(503, 'This job is not set up on this server');
      const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
      if (!sameSecret(token, secret)) throw new HttpError(401, 'Not allowed');
      return json(200, await handler(getServices()));
    } catch (err) {
      return failure(err);
    }
  };
}

/**
 * Wraps a POST handler that needs a signed-in user: (services, user, body) => result.
 * Only HttpError messages reach the client; anything else is logged and hidden.
 */
export function authedPost(getServices, handler) {
  return async (request) => {
    try {
      const services = getServices();
      const user = await authenticate(request, services.auth);
      const body = await readJsonBody(request);
      return json(200, await handler(services, user, body));
    } catch (err) {
      return failure(err);
    }
  };
}
