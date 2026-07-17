const axios = require("axios");
const cacheService = require("../utils/cacheService");
const quotaService = require("../utils/quotaService");

const YOUTUBE_BASE_URL = "https://www.googleapis.com/youtube/v3";
const API_KEY = process.env.YOUTUBE_API_KEY;

// In-flight requests tracking to prevent duplicate API calls
const inflightRequests = new Map();

class YouTubeService {
  /**
   * Search for cooking videos with quota tracking + deduplication
   * Called ONLY when user clicks "Watch Tutorial"
   * Fetches only 1 video (maxResults=1) to minimize quota usage (100 quota per search)
   * Results cached for 7 days per recipe
   */
  async searchCookingVideos(recipeName, limit = 1) {
    try {
      // Validate API key
      if (!API_KEY || API_KEY === "your_youtube_api_key_here") {
        console.warn("YouTube API key not configured");
        return {
          success: false,
          data: [],
          message: "YouTube service not available",
        };
      }

      // Check cache first to avoid repeated searches for same recipe
      const cacheKey = cacheService.generateKey("youtube:video", {
        recipeName,
        limit,
      });
      const cachedResult = cacheService.get(cacheKey);

      if (cachedResult) {
        console.log(`[Cache HIT] YouTube video search: ${recipeName}`);
        return { ...cachedResult, cached: true };
      }

      // Check for in-flight request
      if (inflightRequests.has(cacheKey)) {
        console.log(`[Dedup] Returning in-flight YouTube request: ${cacheKey}`);
        return await inflightRequests.get(cacheKey);
      }

      // Check quota availability (YouTube search uses 100 quota)
      const quotaStatus = await quotaService.checkQuotaAvailability(
        "YOUTUBE",
        100,
      );
      if (!quotaStatus.available) {
        console.warn(
          `[Quota] YouTube quota exhausted. Used: ${quotaStatus.used}/${quotaStatus.dailyLimit}`,
        );
        return {
          success: false,
          data: [],
          message:
            "YouTube quota exhausted. Please try again tomorrow or contact support.",
        };
      }

      const params = {
        part: "snippet",
        q: `${recipeName} recipe tutorial cooking`,
        type: "video",
        key: API_KEY,
        maxResults: Math.min(limit, 1), // Always limit to 1 to save quota
        videoCategoryId: "26", // Category: Howto & Style
        order: "relevance",
        relevanceLanguage: "en",
        maxHeight: 360, // Lower resolution for faster loading
      };

      // Create in-flight promise
      const requestPromise = (async () => {
        try {
          const response = await axios.get(`${YOUTUBE_BASE_URL}/search`, {
            params,
            timeout: 10000,
          });

          if (!response.data.items || response.data.items.length === 0) {
            return {
              success: false,
              data: [],
              message: "No videos found",
            };
          }

          const result = {
            success: true,
            data: response.data.items.map((item) => ({
              videoId: item.id.videoId,
              title: item.snippet.title,
              description: item.snippet.description,
              thumbnail: item.snippet.thumbnails.medium.url,
              channelTitle: item.snippet.channelTitle,
              embeddedUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
              publishedAt: item.snippet.publishedAt,
            })),
            apiUsed: 100,
            timestamp: Date.now(),
          };

          // Cache for 7 days to avoid repeated calls
          cacheService.set(cacheKey, result, "YOUTUBE_VIDEOS");

          // Track quota usage
          await quotaService.incrementUsage("YOUTUBE", 100);

          console.log(
            `[API] YouTube search completed for: ${recipeName} - Found 1 video`,
          );
          return result;
        } catch (error) {
          inflightRequests.delete(cacheKey);
          throw error;
        }
      })();

      // Store in-flight request
      inflightRequests.set(cacheKey, requestPromise);

      const result = await requestPromise;
      inflightRequests.delete(cacheKey);

      return result;
    } catch (error) {
      console.error("YouTube search error:", error.message);
      return {
        success: false,
        data: [],
        message: "Failed to search for cooking videos",
      };
    }
  }

  /**
   * Get video details with quota tracking + caching
   * Each call uses 1 quota, so minimize usage
   */
  async getVideoDetails(videoId) {
    try {
      if (!API_KEY || API_KEY === "your_youtube_api_key_here") {
        return {
          success: false,
          data: null,
          message: "YouTube service not available",
        };
      }

      // Check cache first
      const cacheKey = `youtube:detail:${videoId}`;
      const cachedResult = cacheService.get(cacheKey);

      if (cachedResult) {
        console.log(`[Cache HIT] YouTube video details: ${videoId}`);
        return { ...cachedResult, cached: true };
      }

      // Check quota availability (video.get uses 1 quota)
      const quotaStatus = await quotaService.checkQuotaAvailability(
        "YOUTUBE",
        1,
      );
      if (!quotaStatus.available) {
        console.warn("[Quota] YouTube quota exhausted for video details");
        return {
          success: false,
          data: null,
          message: "YouTube quota exhausted",
        };
      }

      const params = {
        part: "snippet,statistics",
        id: videoId,
        key: API_KEY,
      };

      const response = await axios.get(`${YOUTUBE_BASE_URL}/videos`, {
        params,
        timeout: 10000,
      });

      if (!response.data.items || response.data.items.length === 0) {
        return { success: false, data: null };
      }

      const video = response.data.items[0];

      const result = {
        success: true,
        data: {
          videoId: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnail: video.snippet.thumbnails.high.url,
          channelTitle: video.snippet.channelTitle,
          viewCount: parseInt(video.statistics.viewCount || 0),
          likeCount: parseInt(video.statistics.likeCount || 0),
          embeddedUrl: `https://www.youtube.com/embed/${videoId}`,
        },
        apiUsed: 1,
        timestamp: Date.now(),
      };

      // Cache for 7 days
      cacheService.set(cacheKey, result, "YOUTUBE_VIDEOS");

      // Track quota usage
      await quotaService.incrementUsage("YOUTUBE", 1);

      return result;
    } catch (error) {
      console.error("YouTube details error:", error.message);
      return {
        success: false,
        data: null,
        message: "Failed to fetch video details",
      };
    }
  }

  /**
   * Check if video exists (minimal quota usage)
   * Returns basic availability info without full details
   */
  async checkVideoAvailability(videoId) {
    // This just checks if we have cached data or returns placeholder
    const cacheKey = `youtube:detail:${videoId}`;
    const cachedResult = cacheService.get(cacheKey);
    return {
      videoId,
      cached: !!cachedResult,
      available: true,
    };
  }

  /**
   * Get channel information (for future enhancement)
   */
  async getChannelInfo(channelId) {
    try {
      if (!API_KEY) {
        return { success: false, data: null };
      }

      const cacheKey = `youtube:channel:${channelId}`;
      const cachedResult = cacheService.get(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      const params = {
        part: "snippet,statistics",
        id: channelId,
        key: API_KEY,
      };

      const response = await axios.get(`${YOUTUBE_BASE_URL}/channels`, {
        params,
      });

      if (!response.data.items || response.data.items.length === 0) {
        return { success: false, data: null };
      }

      const channel = response.data.items[0];
      const result = {
        success: true,
        data: {
          channelId: channel.id,
          name: channel.snippet.title,
          description: channel.snippet.description,
          thumbnail: channel.snippet.thumbnails.medium.url,
          subscribers: channel.statistics.subscriberCount,
          videoCount: channel.statistics.videoCount,
        },
      };

      // Cache for 7 days
      cacheService.set(cacheKey, result, "YOUTUBE_VIDEOS");

      return result;
    } catch (error) {
      console.error("Channel info error:", error.message);
      return { success: false, data: null };
    }
  }
}

module.exports = new YouTubeService();
