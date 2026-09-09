type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type InFlightEntry<T> = {
  promise: Promise<T>;
  startTime: number;
};

const DEFAULT_TTL_MS = 120_000;
const MAX_INFLIGHT_WAIT_MS = 30_000;

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, InFlightEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCached<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    memoryCache.clear();
    inFlight.clear();
    return;
  }
  for (const k of Array.from(memoryCache.keys())) {
    if (k.startsWith(keyPrefix)) memoryCache.delete(k);
  }
  for (const k of Array.from(inFlight.keys())) {
    if (k.startsWith(keyPrefix)) inFlight.delete(k);
  }
}

export async function withDedupe<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) return cached;

  const existingInFlight = inFlight.get(key) as InFlightEntry<T> | undefined;
  if (existingInFlight) {
    const waitMs = Date.now() - existingInFlight.startTime;
    if (waitMs < MAX_INFLIGHT_WAIT_MS) {
      return existingInFlight.promise;
    }
    inFlight.delete(key);
  }

  const promise = (async () => {
    try {
      const result = await fn();
      setCached(key, result, ttlMs);
      return result;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, { promise, startTime: Date.now() });
  return promise;
}
