/** Injectable HTTP layer: pipelines take a Fetcher so tests/offline mode can
 *  substitute recorded fixtures (see pipelines/lib/fixtures.ts). */

export type Fetcher = (url: string, init?: RequestInit) => Promise<unknown>;

const RETRIES = 4;
const BASE_DELAY_MS = 2000;

export const liveFetcher: Fetcher = async (url, init) => {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status} from ${url}`);
      }
      if (!res.ok) {
        // 4xx other than 429: retrying won't help
        const body = await res.text();
        throw new NonRetryableError(`HTTP ${res.status} from ${url}: ${body.slice(0, 300)}`);
      }
      return res.json();
    } catch (err) {
      if (err instanceof NonRetryableError) throw err;
      lastErr = err;
      if (attempt < RETRIES) {
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt));
      }
    }
  }
  throw lastErr;
};

export class NonRetryableError extends Error {}

/** Like liveFetcher but returns the raw body (YAML / XML / CSV sources). */
export type TextFetcher = (url: string) => Promise<string>;

export const liveTextFetcher: TextFetcher = async (url) => {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status} from ${url}`);
      if (!res.ok) throw new NonRetryableError(`HTTP ${res.status} from ${url}`);
      return res.text();
    } catch (err) {
      if (err instanceof NonRetryableError) throw err;
      lastErr = err;
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt));
    }
  }
  throw lastErr;
};

export function postInit(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
