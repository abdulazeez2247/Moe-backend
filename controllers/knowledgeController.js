const {
  getChannelVideosWithCaptions,
  getChannelStats,
} = require("../services/youtubeService");

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const CHANNEL_IDS = process.env.YOUTUBE_CHANNEL_IDS
  ? process.env.YOUTUBE_CHANNEL_IDS.split(",")
  : [];

function tagByTopic(text) {
  const lower = text.toLowerCase();
  if (lower.includes("cam")) return "CAM";
  if (lower.includes("setup")) return "Setup";
  if (lower.includes("troubleshoot")) return "Troubleshooting";
  if (lower.includes("mozaik")) return "Mozaik";
  return "General";
}

function deduplicate(videos) {
  const seen = new Set();
  return videos.filter((v) => {
    if (seen.has(v.videoId)) return false;
    seen.add(v.videoId);
    return true;
  });
}

const getKnowledgeStatus = async (req, res) => {
  try {
    let results = [];

    for (const channelId of CHANNEL_IDS) {
      try {
        const stats = await getChannelStats(channelId, YOUTUBE_API_KEY);
        const videos = await getChannelVideosWithCaptions(
          channelId,
          YOUTUBE_API_KEY,
          10
        );

        const taggedVideos = videos.map((v) => ({
          ...v,
          topic: tagByTopic(`${v.title} ${v.description}`),
          stats,
        }));

        results = results.concat(taggedVideos);
      } catch (channelError) {
        console.error(
          `Error processing channel ${channelId}:`,
          channelError.message
        );

        continue;
      }
    }

    const uniqueResults = deduplicate(results);

    res.status(200).json({
      success: true,
      total: uniqueResults.length,
      data: uniqueResults,
    });
  } catch (error) {
    console.error("Knowledge fetch error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch knowledge data",
      error: error.message,
    });
  }
};

module.exports = { getKnowledgeStatus };
