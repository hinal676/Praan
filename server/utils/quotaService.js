/**
 * API Quota Management Service
 * Tracks API usage across Spoonacular and YouTube only (Edamam removed)
 * Ensures free tier limits are not exceeded
 *
 * Free Tier Limits:
 * - Spoonacular: 5 generation calls/day (seeding + generation)
 * - YouTube: 10,000 quota/day (search=100, details=1)
 */

const fs = require("fs").promises;
const path = require("path");

const QUOTA_LIMITS = {
  SPOONACULAR: parseInt(process.env.SPOONACULAR_DAILY_QUOTA || "5"),
  YOUTUBE: parseInt(process.env.YOUTUBE_DAILY_QUOTA || "10000"),
};

const QUOTA_FILE = path.join(__dirname, "../data/quota-tracking.json");

class QuotaService {
  /**
   * Initialize quota service
   */
  constructor() {
    this.quotaData = null;
    this.initialized = false;
  }

  /**
   * Initialize quota tracking from file
   */
  async initialize() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(QUOTA_FILE);
      await fs.mkdir(dataDir, { recursive: true });

      try {
        const data = await fs.readFile(QUOTA_FILE, "utf-8");
        this.quotaData = JSON.parse(data);
      } catch (err) {
        // File doesn't exist, create new quota tracking
        this.quotaData = this._initializeQuotaData();
        await this._saveQuotaData();
      }

      // Check if quota needs reset (new day)
      this._checkAndResetQuota();
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize quota service:", error);
      this.quotaData = this._initializeQuotaData();
    }
  }

  /**
   * Check if API quota is available
   * @param {string} api - API name (SPOONACULAR, YOUTUBE)
   * @param {number} cost - Quota cost of the request
   * @returns {object} Quota status
   */
  async checkQuotaAvailability(api, cost = 1) {
    await this._ensureInitialized();

    const today = this._getToday();
    const apiData = this.quotaData[api] || {};
    const usage = apiData[today] || 0;
    const limit = QUOTA_LIMITS[api] || Infinity;

    return {
      available: usage + cost <= limit,
      used: usage,
      remaining: Math.max(0, limit - usage),
      dailyLimit: limit,
      percentUsed: Math.round((usage / limit) * 100),
      api,
    };
  }

  /**
   * Increment API usage
   * @param {string} api - API name
   * @param {number} cost - Quota cost to add
   */
  async incrementUsage(api, cost = 1) {
    await this._ensureInitialized();

    const today = this._getToday();

    if (!this.quotaData[api]) {
      this.quotaData[api] = {};
    }

    this.quotaData[api][today] = (this.quotaData[api][today] || 0) + cost;

    await this._saveQuotaData();

    const status = await this.checkQuotaAvailability(api, 0);
    console.log(
      `[Quota] ${api}: ${status.used}/${status.dailyLimit} (${status.percentUsed}% used)`,
    );

    return status;
  }

  /**
   * Get quota statistics for all APIs
   */
  async getQuotaStats() {
    await this._ensureInitialized();

    const today = this._getToday();
    const stats = {};

    for (const [api, limit] of Object.entries(QUOTA_LIMITS)) {
      const usage = this.quotaData[api]?.[today] || 0;
      stats[api] = {
        used: usage,
        limit,
        remaining: Math.max(0, limit - usage),
        percentUsed: Math.round((usage / limit) * 100),
        status:
          usage / limit > 0.9
            ? "warning"
            : usage / limit > 0.5
              ? "moderate"
              : "healthy",
      };
    }

    return stats;
  }

  /**
   * Get reset time (next midnight UTC)
   */
  getResetTime() {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const resetMs = tomorrow - now;
    return {
      resetAt: tomorrow.toISOString(),
      resetInMinutes: Math.floor(resetMs / 60000),
      resetInSeconds: Math.floor(resetMs / 1000),
    };
  }

  /**
   * Reset quotas for specific API (admin only)
   */
  async resetQuota(api = null) {
    await this._ensureInitialized();

    const today = this._getToday();

    if (api) {
      this.quotaData[api] = this.quotaData[api] || {};
      this.quotaData[api][today] = 0;
      console.log(`[Quota] Reset ${api} quota for today`);
    } else {
      for (const apiName of Object.keys(QUOTA_LIMITS)) {
        this.quotaData[apiName] = this.quotaData[apiName] || {};
        this.quotaData[apiName][today] = 0;
      }
      console.log("[Quota] Reset all quotas for today");
    }

    await this._saveQuotaData();
  }

  /**
   * Get today's date in YYYY-MM-DD format (UTC)
   */
  _getToday() {
    const now = new Date();
    return now.toISOString().split("T")[0];
  }

  /**
   * Initialize quota data structure
   */
  _initializeQuotaData() {
    return {
      SPOONACULAR: {},
      YOUTUBE: {},
      lastReset: new Date().toISOString(),
    };
  }

  /**
   * Check and reset quota if it's a new day
   */
  _checkAndResetQuota() {
    const today = this._getToday();
    const lastReset = this.quotaData.lastReset?.split("T")[0];

    // Only keep last 7 days of quota data
    if (lastReset !== today) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cutoffDate = sevenDaysAgo.toISOString().split("T")[0];

      for (const api of Object.keys(this.quotaData)) {
        if (api === "lastReset") continue;

        const dates = Object.keys(this.quotaData[api]);
        dates.forEach((date) => {
          if (date < cutoffDate) {
            delete this.quotaData[api][date];
          }
        });
      }

      this.quotaData.lastReset = new Date().toISOString();
    }
  }

  /**
   * Save quota data to file
   */
  async _saveQuotaData() {
    try {
      await fs.writeFile(
        QUOTA_FILE,
        JSON.stringify(this.quotaData, null, 2),
        "utf-8",
      );
    } catch (error) {
      console.error("Failed to save quota data:", error);
    }
  }

  /**
   * Ensure service is initialized
   */
  async _ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Export singleton instance
module.exports = new QuotaService();
