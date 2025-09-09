const axios = require("axios");
const API_BASE = "https://www.googleapis.com/youtube/v3";

// Resolve channelId from handle (e.g. @MozaikSoftware)
const getChannelIdFromHandle = async (handle, apiKey) => {
  const url = `${API_BASE}/search?part=snippet&type=channel&q=${handle}&key=${apiKey}`;
  const { data } = await axios.get(url);

  if (!data.items || data.items.length === 0) {
    throw new Error(`Channel not found for handle: ${handle}`);
  }

  return data.items[0].snippet.channelId;
};

// Fetch videos (snippet + metadata)
const getChannelVideosWithCaptions = async (channelId, apiKey, maxResults = 10) => {
  const url = `${API_BASE}/search?key=${apiKey}&channelId=${channelId}&part=snippet,id&order=date&maxResults=${maxResults}`;
  const { data } = await axios.get(url);

  if (!data.items) return [];

  return data.items.map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    publishedAt: item.snippet.publishedAt,
    thumbnail: item.snippet.thumbnails?.high?.url,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    source: "YouTube",
    channelId: item.snippet.channelId,
    captions: null, // Placeholder (needs YouTube Captions API if enabled)
  }));
};

// Fetch detailed channel stats
const getChannelStats = async (channelId, apiKey) => {
  const url = `${API_BASE}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
  const { data } = await axios.get(url);

  if (!data.items || data.items.length === 0) return null;

  const channel = data.items[0];
  return {
    channelId: channel.id,
    title: channel.snippet.title,
    description: channel.snippet.description,
    subscribers: channel.statistics.subscriberCount,
    totalViews: channel.statistics.viewCount,
    videoCount: channel.statistics.videoCount,
    thumbnail: channel.snippet.thumbnails?.high?.url,
  };
};

module.exports = {
  getChannelIdFromHandle,
  getChannelVideosWithCaptions,
  getChannelStats,
};
