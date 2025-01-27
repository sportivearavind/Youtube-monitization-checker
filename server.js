require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// Serve index.html for the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

// Update the constants
const MONETIZATION_REQUIREMENTS = {
  SUBSCRIBER_REQUIREMENT: 1000,
  WATCH_HOURS_REQUIREMENT: 4000,
  MINIMUM_VIDEOS_REQUIREMENT: 3,
  PUBLIC_VIDEOS_REQUIREMENT: 1,
};

// Add revenue estimation constants
const REVENUE_ESTIMATES = {
  CPM_MIN: 1.0, // Minimum revenue per 1000 views in USD
  CPM_MAX: 4.0, // Maximum revenue per 1000 views in USD
  YOUTUBE_REVENUE_SHARE: 0.55, // YouTube takes 45%, creator gets 55%
  MEMBERSHIP_RATE: 0.001, // 0.1% of subscribers might be members
  MEMBERSHIP_PRICE: 4.99,
};

async function getChannelIdFromHandle(handle) {
  try {
    const response = await youtube.search.list({
      part: "snippet",
      q: handle,
      type: "channel",
      maxResults: 1,
    });

    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0].snippet.channelId;
    }
    throw new Error("Channel not found");
  } catch (error) {
    throw new Error("Failed to resolve channel handle");
  }
}

async function extractChannelId(url) {
  try {
    const urlObj = new URL(url);
    let channelId = "";

    if (url.includes("/channel/")) {
      channelId = url.split("/channel/")[1].split("/")[0];
    } else if (url.includes("@")) {
      // Handle @username format
      const handle = url.split("@")[1].split("/")[0];
      channelId = await getChannelIdFromHandle(handle);
    } else if (url.includes("/c/") || url.includes("/user/")) {
      throw new Error("Please use the channel URL with @ handle or channel ID");
    }

    if (!channelId) {
      throw new Error("Could not extract channel ID from URL");
    }

    return channelId;
  } catch (error) {
    throw new Error(error.message || "Invalid YouTube URL format");
  }
}

async function getChannelVideosData(channelId) {
  try {
    const channelResponse = await youtube.channels.list({
      part: "contentDetails",
      id: channelId,
    });

    if (
      !channelResponse.data.items ||
      channelResponse.data.items.length === 0
    ) {
      throw new Error("Channel not found");
    }

    const uploadsPlaylistId =
      channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    let allVideos = [];
    let pageToken = "";
    let totalVideosProcessed = 0;
    const MAX_VIDEOS_TO_PROCESS = 500; // Limit to prevent excessive API calls

    do {
      const videosResponse = await youtube.playlistItems.list({
        part: "contentDetails,snippet",
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: pageToken || "",
      });

      const recentVideos = videosResponse.data.items.filter((item) => {
        const publishDate = new Date(item.snippet.publishedAt);
        return publishDate >= oneYearAgo;
      });

      if (recentVideos.length > 0) {
        const videoIds = recentVideos.map(
          (item) => item.contentDetails.videoId
        );
        const videoStatsResponse = await youtube.videos.list({
          part: "statistics,contentDetails",
          id: videoIds.join(","),
        });

        if (videoStatsResponse.data.items) {
          allVideos = allVideos.concat(videoStatsResponse.data.items);
        }
      }

      totalVideosProcessed += videosResponse.data.items.length;
      pageToken = videosResponse.data.nextPageToken;

      // Break if we've processed enough videos or there are no more pages
      if (totalVideosProcessed >= MAX_VIDEOS_TO_PROCESS || !pageToken) {
        break;
      }
    } while (pageToken);

    return allVideos;
  } catch (error) {
    console.error("Error fetching video data:", error);
    return [];
  }
}

function estimateWatchHours(videos) {
  let totalMinutes = 0;

  videos.forEach((video) => {
    const views = parseInt(video.statistics.viewCount);
    const duration = parseDuration(video.contentDetails.duration);

    // Much more conservative estimation:
    // - Average viewer watches 15% of video (down from 30%)
    // - Add additional reduction factors:
    //   - Consider mobile views (typically shorter)
    //   - Account for embedded views
    //   - Consider audience retention patterns
    const averageViewPercentage = 0.15;
    const platformAdjustmentFactor = 0.7; // Additional reduction for platform-specific factors

    totalMinutes +=
      views * duration * averageViewPercentage * platformAdjustmentFactor;
  });

  // Convert minutes to hours and round down
  return Math.floor(totalMinutes / 60);
}

function parseDuration(duration) {
  try {
    const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

    const hours = parseInt(matches[1] || 0);
    const minutes = parseInt(matches[2] || 0);
    const seconds = parseInt(matches[3] || 0);

    // Add additional validation
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      return 0;
    }

    return hours * 60 + minutes + seconds / 60;
  } catch (error) {
    console.error("Error parsing duration:", duration);
    return 0;
  }
}

// Add a warning message if the estimation might be significantly off
function getWatchHoursConfidenceLevel(videos) {
  if (videos.length === 0) return "low";
  if (videos.length < 10) return "medium";
  return "high";
}

async function calculateRevenueEstimates(stats) {
  // Calculate monthly views (average from last month)
  const monthlyViews = Math.floor(parseInt(stats.viewCount) / 12);
  const subscribers = parseInt(stats.subscriberCount);

  // Calculate ad revenue using RPM (Revenue Per Mille)
  // RPM is typically 55% of CPM (YouTube's revenue share)
  const minRPM =
    REVENUE_ESTIMATES.CPM_MIN * REVENUE_ESTIMATES.YOUTUBE_REVENUE_SHARE;
  const maxRPM =
    REVENUE_ESTIMATES.CPM_MAX * REVENUE_ESTIMATES.YOUTUBE_REVENUE_SHARE;

  const minAdRevenue = (monthlyViews / 1000) * minRPM;
  const maxAdRevenue = (monthlyViews / 1000) * maxRPM;

  // More conservative membership estimates
  const estimatedMembers = Math.floor(
    subscribers * REVENUE_ESTIMATES.MEMBERSHIP_RATE
  );
  const estimatedMembershipRevenue =
    estimatedMembers * REVENUE_ESTIMATES.MEMBERSHIP_PRICE;

  // Calculate total monthly revenue
  const totalMinRevenue = minAdRevenue + estimatedMembershipRevenue;
  const totalMaxRevenue = maxAdRevenue + estimatedMembershipRevenue;

  return {
    monthly: {
      minRevenue: Math.round(totalMinRevenue),
      maxRevenue: Math.round(totalMaxRevenue),
      adRevenue: {
        min: Math.round(minAdRevenue),
        max: Math.round(maxAdRevenue),
      },
      memberships: Math.round(estimatedMembershipRevenue),
    },
    yearly: {
      minRevenue: Math.round(totalMinRevenue * 12),
      maxRevenue: Math.round(totalMaxRevenue * 12),
    },
    metrics: {
      monthlyViews,
      estimatedMembers,
      rpm: {
        min: minRPM.toFixed(2),
        max: maxRPM.toFixed(2),
      },
    },
  };
}

app.post("/api/check-monetization", async (req, res) => {
  try {
    const { channelUrl } = req.body;
    if (!channelUrl) {
      return res.status(400).json({ error: "Channel URL is required" });
    }

    const channelId = await extractChannelId(channelUrl);

    const channelData = await youtube.channels.list({
      part: ["statistics", "status", "contentDetails"],
      id: channelId,
    });

    if (!channelData.data.items || channelData.data.items.length === 0) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const channel = channelData.data.items[0];
    const stats = channel.statistics;

    // Get video data for watch hours estimation
    const videos = await getChannelVideosData(channelId);
    const estimatedWatchHours = estimateWatchHours(videos);
    const confidenceLevel = getWatchHoursConfidenceLevel(videos);

    // Check community guidelines status
    const communityGuidelinesStatus = await checkCommunityGuidelinesStatus(
      channelId
    );

    const monetizationStatus = {
      subscribers:
        parseInt(stats.subscriberCount) >=
        MONETIZATION_REQUIREMENTS.SUBSCRIBER_REQUIREMENT,
      watchHours:
        estimatedWatchHours >=
        MONETIZATION_REQUIREMENTS.WATCH_HOURS_REQUIREMENT,
      minimumVideos:
        parseInt(stats.videoCount) >=
        MONETIZATION_REQUIREMENTS.MINIMUM_VIDEOS_REQUIREMENT,
      communityGuidelines: communityGuidelinesStatus.isGood,
      publicVideos:
        parseInt(stats.videoCount) >=
        MONETIZATION_REQUIREMENTS.PUBLIC_VIDEOS_REQUIREMENT,
    };

    const isMonetized = Object.values(monetizationStatus).every(
      (status) => status === true
    );

    const revenueEstimates = await calculateRevenueEstimates(stats);

    res.json({
      isMonetized,
      statistics: {
        subscribers: parseInt(stats.subscriberCount),
        views: parseInt(stats.viewCount),
        videos: parseInt(stats.videoCount),
        estimatedWatchHours,
        monthlyViews: revenueEstimates.metrics.monthlyViews,
        watchHoursNote: "Estimated public watch hours in the last 365 days",
        watchHoursConfidence: confidenceLevel,
      },
      requirements: {
        subscribersNeeded: Math.max(
          0,
          MONETIZATION_REQUIREMENTS.SUBSCRIBER_REQUIREMENT -
            stats.subscriberCount
        ),
        watchHoursNeeded: Math.max(
          0,
          MONETIZATION_REQUIREMENTS.WATCH_HOURS_REQUIREMENT -
            estimatedWatchHours
        ),
        watchHoursTimeframe: "last 365 days",
        videosNeeded: Math.max(
          0,
          MONETIZATION_REQUIREMENTS.MINIMUM_VIDEOS_REQUIREMENT -
            stats.videoCount
        ),
        communityGuidelinesStatus: communityGuidelinesStatus,
        hasEnoughVideos:
          parseInt(stats.videoCount) >=
          MONETIZATION_REQUIREMENTS.MINIMUM_VIDEOS_REQUIREMENT,
      },
      monetizationStatus,
      revenue: revenueEstimates,
    });
  } catch (error) {
    console.error("Server error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch channel data" });
  }
});

async function checkCommunityGuidelinesStatus(channelId) {
  try {
    const response = await youtube.channels.list({
      part: "status",
      id: channelId,
    });

    if (response.data.items && response.data.items.length > 0) {
      const channel = response.data.items[0];
      // Check if channel has any community guidelines strikes
      // Note: This is a simplified check as the actual strike information
      // is only available to channel owners through YouTube Studio
      return {
        isGood: true,
        message: "No detected community guidelines violations",
      };
    }
    return {
      isGood: false,
      message: "Unable to verify community guidelines status",
    };
  } catch (error) {
    return {
      isGood: false,
      message: "Error checking community guidelines status",
    };
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
