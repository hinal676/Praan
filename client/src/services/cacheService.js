class ClientCacheService {
  constructor() {
    this.STORAGE_PREFIX = "praan_cache_";
    this.METADATA_PREFIX = "praan_meta_";
    this.TTL = {
      SPOONACULAR_RECIPES: 30 * 60 * 1000,
      SPOONACULAR_DETAILS: 24 * 60 * 60 * 1000,
      YOUTUBE_VIDEOS: 7 * 24 * 60 * 60 * 1000,
      EDAMAM_RECIPES: 60 * 60 * 1000,
      GENERAL: 24 * 60 * 60 * 1000,
    };
  }

  set(key, value, ttl = "GENERAL") {
    try {
      const actualTtl = typeof ttl === "string" ? this.TTL[ttl] : ttl;
      const expiresAt = Date.now() + actualTtl;
      const storageKey = this.STORAGE_PREFIX + key;
      const metadata = {
        createdAt: Date.now(),
        expiresAt,
        ttl: actualTtl,
        size: JSON.stringify(value).length,
      };

      localStorage.setItem(storageKey, JSON.stringify(value));
      localStorage.setItem(
        this.METADATA_PREFIX + key,
        JSON.stringify(metadata),
      );
    } catch (error) {
      console.warn("Cache set failed (localStorage full?):", error.message);
      this._cleanupExpiredCache();
    }
  }

  get(key) {
    try {
      const storageKey = this.STORAGE_PREFIX + key;
      const metadataKey = this.METADATA_PREFIX + key;

      const metadata = localStorage.getItem(metadataKey);
      if (!metadata) {
        return null;
      }

      const meta = JSON.parse(metadata);
      if (Date.now() > meta.expiresAt) {
        this.delete(key);
        return null;
      }

      const value = localStorage.getItem(storageKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn("Cache get failed:", error.message);
      return null;
    }
  }

  delete(key) {
    try {
      localStorage.removeItem(this.STORAGE_PREFIX + key);
      localStorage.removeItem(this.METADATA_PREFIX + key);
    } catch (error) {
      console.warn("Cache delete failed:", error.message);
    }
  }

  generateKey(prefix, data) {
    return `${prefix}:${JSON.stringify(data)}`;
  }

  _cleanupExpiredCache() {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();

      keys.forEach((key) => {
        if (key.startsWith(this.METADATA_PREFIX)) {
          try {
            const meta = JSON.parse(localStorage.getItem(key));
            if (now > meta.expiresAt) {
              const cacheKey = key.replace(this.METADATA_PREFIX, "");
              this.delete(cacheKey);
            }
          } catch {
            // Ignore parse errors.
          }
        }
      });
    } catch (error) {
      console.warn("Cleanup failed:", error.message);
    }
  }
}

export const clientCacheService = new ClientCacheService();
