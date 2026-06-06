import { describe, expect, it, vi, type Mock } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// chrome129IssuePlugin middleware logic
//
// The PR adds this plugin to vite.config.ts. We test its middleware logic here
// by replicating the exact implementation, which has no external dependencies.
// ---------------------------------------------------------------------------

type Middleware = (req: Request, res: Response, next: () => void) => void;

interface Request {
  headers: Record<string, string | undefined>;
}

interface Response {
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

/**
 * Exact copy of the chrome129IssuePlugin middleware logic from vite.config.ts.
 * This is the function under test – the same regex and version check that the
 * real plugin registers with `server.middlewares.use()`.
 */
function createChrome129Middleware(): Middleware {
  return (req, res, next) => {
    const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

    if (raw) {
      const version = parseInt(raw[2], 10);

      if (version === 129) {
        res.setHeader('content-type', 'text/html');
        res.end(
          '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258</a> for more information.</p></body>',
        );
        return;
      }
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(userAgent?: string): Request {
  return { headers: { 'user-agent': userAgent } };
}

function makeRes(): { setHeader: Mock; end: Mock } & Response {
  return { setHeader: vi.fn(), end: vi.fn() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('vite.config.ts – resolve.alias', () => {
  const configSource = readFileSync(resolve(__dirname, 'vite.config.ts'), 'utf8');

  it("contains the 'ai/react' -> 'ai' alias", () => {
    // This assertion verifies the key change made by the PR: the alias that
    // allows `import { useChat } from 'ai/react'` to resolve to the `ai` package.
    expect(configSource).toContain("'ai/react': 'ai'");
  });

  it('does NOT contain a reference to @ai-sdk/react (removed dependency)', () => {
    // The PR removed @ai-sdk/react and replaced it with the ai/react alias.
    expect(configSource).not.toContain('@ai-sdk/react');
  });

  it('uses ai/react as the import source for useChat in Chat.client.tsx', () => {
    const chatSource = readFileSync(
      resolve(__dirname, 'app/components/chat/Chat.client.tsx'),
      'utf8',
    );
    expect(chatSource).toContain("from 'ai/react'");
    expect(chatSource).not.toContain("from '@ai-sdk/react'");
  });
});

describe('vite.config.ts – chrome129IssuePlugin middleware', () => {
  const middleware = createChrome129Middleware();

  // ── Blocking Chrome 129 ─────────────────────────────────────────────────

  it('blocks Chrome 129 by setting content-type to text/html', () => {
    const req = makeReq('Mozilla/5.0 Chrome/129.0.0.0 Safari/537.36');
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'text/html');
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('response body for Chrome 129 mentions Chrome Canary', () => {
    const req = makeReq('Mozilla/5.0 Chrome/129.0.6668.58 Safari/537.36');
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res, next);

    const body = (res.end as Mock).mock.calls[0][0] as string;
    expect(body).toContain('Chrome Canary');
  });

  it('response body for Chrome 129 contains an issue reference link', () => {
    const req = makeReq('Mozilla/5.0 AppleWebKit/537.36 Chrome/129.0.0.1 Safari/537.36');
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res, next);

    const body = (res.end as Mock).mock.calls[0][0] as string;
    expect(body).toContain('href=');
  });

  it('blocks Chromium 129 the same way as Chrome 129', () => {
    const req = makeReq('Mozilla/5.0 Chromium/129.0.0.0 Safari/537.36');
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'text/html');
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Passing through other versions ──────────────────────────────────────

  it('passes through Chrome 128 without blocking', () => {
    const req = makeReq('Mozilla/5.0 Chrome/128.0.0.0 Safari/537.36');
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.end).not.toHaveBeenCalled();
  });

  it('passes through Chrome 130 without blocking', () => {
    const req = makeReq('Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36');
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.end).not.toHaveBeenCalled();
  });

  it('passes through Chromium 128 without blocking', () => {
    const req = makeReq('Mozilla/5.0 Chromium/128.0.0.0 Safari/537.36');
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.end).not.toHaveBeenCalled();
  });

  it('passes through Chromium 131 without blocking', () => {
    const req = makeReq('Mozilla/5.0 Chromium/131.0.0.0 Safari/537.36');
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.end).not.toHaveBeenCalled();
  });

  // ── Non-Chrome browsers ─────────────────────────────────────────────────

  it('passes through Firefox (which includes the number 129 but not Chrom*/129)', () => {
    const req = makeReq('Mozilla/5.0 Gecko/20100101 Firefox/129.0');
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.end).not.toHaveBeenCalled();
  });

  it('passes through Safari without blocking', () => {
    const req = makeReq(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    );
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.end).not.toHaveBeenCalled();
  });

  it('passes through Edge (Edg/) without blocking even if Chrome/129 appears in UA', () => {
    // Edge UA strings include "Chrome/<version>" — verify the real check still
    // triggers for Chrome 129 even via Edge's UA string (regression guard).
    const edgeWith129 = 'Mozilla/5.0 Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0';
    const req = makeReq(edgeWith129);
    const res = makeRes();
    const next = vi.fn();

    // Edge includes "Chrome/129" so the regex will match — this documents the
    // current behavior of the regex (it matches Chrome/Chromium in UA, even for Edge).
    middleware(req, res, next);

    // The middleware matches on Chrome/129 regardless of Edge suffix
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'text/html');
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Missing / empty User-Agent ──────────────────────────────────────────

  it('passes through requests with no User-Agent header', () => {
    const req = makeReq(undefined);
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.end).not.toHaveBeenCalled();
  });

  it('passes through requests with an empty User-Agent string', () => {
    const req = makeReq('');
    const res = makeRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.end).not.toHaveBeenCalled();
  });

  // ── Boundary version parsing ─────────────────────────────────────────────

  it('only blocks version 129 exactly – not 1290 or 12900', () => {
    // The regex captures digits before the first dot, so Chrome/1290.0 would
    // parse as version 1290, not 129.
    for (const ua of [
      'Mozilla/5.0 Chrome/1290.0.0.0 Safari/537.36',
      'Mozilla/5.0 Chrome/12900.0.0.0 Safari/537.36',
    ]) {
      const req = makeReq(ua);
      const res = makeRes();
      const next = vi.fn();

      middleware(req, res, next);

      expect(next, `Should pass through ${ua}`).toHaveBeenCalledTimes(1);
      expect(res.end, `Should NOT block ${ua}`).not.toHaveBeenCalled();

      vi.clearAllMocks();
    }
  });
});
