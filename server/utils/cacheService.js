let recipeCache = new Map();

// Cache TTL in seconds (seeded recipes cached 24 hours)
const CACHE_TTL = {
  SPOONACULAR_RECIPES: 24 * 60 * 60, // 24 hours (seeded recipes)
  SPOONACULAR_DETAILS: 24 * 60 * 60, // 24 hours
  YOUTUBE_VIDEOS: 7 * 24 * 60 * 60, // 7 days
  GENERAL: process.env.CACHE_TTL || 24 * 60 * 60, // 24 hours
};

class CacheService {
  /**
   * Set cache with optional TTL override
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number|string} ttl - TTL in seconds or key for CACHE_TTL object
   */
  set(key, value, ttl = CACHE_TTL.GENERAL) {
    // If ttl is a string, use it as a key from CACHE_TTL
    const actualTtl = typeof ttl === "string" ? CACHE_TTL[ttl] : ttl;
    const expiresAt = Date.now() + actualTtl * 1000;

    recipeCache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
      ttl: actualTtl,
    });

    // Optional: Log cache set for monitoring
    this._logCacheEvent("SET", key, actualTtl);
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null
   */
  get(key) {
    const cached = recipeCache.get(key);

    if (!cached) {
      this._logCacheEvent("MISS", key);
      return null;
    }

    // Check if cache has expired
    if (Date.now() > cached.expiresAt) {
      recipeCache.delete(key);
      this._logCacheEvent("EXPIRED", key, cached.ttl);
      return null;
    }

    this._logCacheEvent("HIT", key);
    return cached.value;
  }

  /**
   * Get cache metadata (for debugging)
   * @param {string} key - Cache key
   * @returns {object} Cache metadata or null
   */
  getMetadata(key) {
    const cached = recipeCache.get(key);
    if (!cached) return null;

    return {
      createdAt: new Date(cached.createdAt).toISOString(),
      expiresAt: new Date(cached.expiresAt).toISOString(),
      ttl: cached.ttl,
      isExpired: Date.now() > cached.expiresAt,
      ageMs: Date.now() - cached.createdAt,
    };
  }

  /**
   * Delete specific cache key
   * @param {string} key - Cache key
   */
  delete(key) {
    recipeCache.delete(key);
    this._logCacheEvent("DELETE", key);
  }

  /**
   * Clear all cache
   */
  clear() {
    const size = recipeCache.size;
    recipeCache.clear();
    this._logCacheEvent("CLEAR", `${size} items cleared`);
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    let totalItems = 0;
    let expiredItems = 0;
    const now = Date.now();

    recipeCache.forEach((cached) => {
      totalItems++;
      if (now > cached.expiresAt) {
        expiredItems++;
      }
    });

    // Clean up expired items
    if (expiredItems > 0) {
      Array.from(recipeCache.entries()).forEach(([key, cached]) => {
        if (now > cached.expiresAt) {
          recipeCache.delete(key);
        }
      });
    }

    return {
      totalItems: totalItems,
      activeItems: totalItems - expiredItems,
      expiredItems: expiredItems,
      cacheSize: JSON.stringify(Array.from(recipeCache.values())).length,
    };
  }

  /**
   * Generate cache key from preferences
   * @param {string} prefix - Cache prefix
   * @param {*} data - Data to serialize
   * @returns {string} Cache key
   */
  generateKey(prefix, data) {
    return `${prefix}:${JSON.stringify(data)}`;
  }

  /**
   * Check if cache key exists and is valid
   * @param {string} key - Cache key
   * @returns {boolean} True if cache exists and not expired
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Private: Log cache events for monitoring
   */
  _logCacheEvent(event, key, ttl = null) {
    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
      const ttlStr = ttl ? ` (TTL: ${ttl}s)` : "";
      console.log(`[CACHE ${event}] ${key}${ttlStr}`);
    }
  }
}

module.exports = new CacheService();
