
const buckets = new Map();

function makeLimiter({ windowMs = 60_000, max = 10 } = {}) {
  return function limit(key) {
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || now - current.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return true;
    }

    if (current.count >= max) {
      return false;
    }

    current.count += 1;
    return true;
  };
}

module.exports = { makeLimiter };
