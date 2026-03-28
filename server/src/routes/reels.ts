import { Hono } from "hono";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";

interface YouTubeVideo {
	id: { kind: string; videoId: string };
	snippet: {
		title: string;
		description: string;
		channelTitle: string;
		publishedAt: string;
		thumbnails: {
			high: { url: string; width: number; height: number };
			medium: { url: string };
			default: { url: string };
		};
	};
}

interface YouTubeSearchResponse {
	items: YouTubeVideo[];
	nextPageToken?: string;
	pageInfo: {
		totalResults: number;
		resultsPerPage: number;
	};
}

// Cache to reduce API calls
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCached(key: string) {
	const cached = cache.get(key);
	if (!cached) return null;
	if (Date.now() - cached.timestamp > CACHE_TTL) {
		cache.delete(key);
		return null;
	}
	return cached.data;
}

function setCache(key: string, data: any) {
	cache.set(key, { data, timestamp: Date.now() });
}

// Search queries for variety (rotate based on page)
const SEARCH_QUERIES = [
	"coding shorts",
	"programming memes",
	"tech shorts",
	"developer life",
	"software engineering",
	"funny coding",
	"javascript tips",
	"python tricks",
	"web development",
	"brainrot coding",
];

const reelsRoutes = new Hono()
	// GET /api/reels?page=1&limit=5
	.get("/", async (c) => {
		try {
			if (!YOUTUBE_API_KEY) {
				return c.json(
					{
						success: false,
						error: "YOUTUBE_API_KEY not configured",
						reels: [],
						hasMore: false,
					},
					500
				);
			}

			const page = parseInt(c.req.query("page") || "1");
			const limit = parseInt(c.req.query("limit") || "10");

			// Rotate search query based on page for variety
			const queryIndex = (page - 1) % SEARCH_QUERIES.length;
			const searchQuery = SEARCH_QUERIES[queryIndex];

			const cacheKey = `youtube_shorts_${searchQuery}_${page}_${limit}`;
			const cached = getCached(cacheKey);
			if (cached) {
				return c.json(cached);
			}

			// YouTube API: Search for Shorts (vertical videos under 60s)
			const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&q=${encodeURIComponent(
				searchQuery ?? ""
			)}&maxResults=${limit}&key=${YOUTUBE_API_KEY}`;

			const response = await fetch(apiUrl);

			if (!response.ok) {
				throw new Error(`YouTube API error: ${response.status}`);
			}

			const data = (await response.json()) as YouTubeSearchResponse;

			// Transform to our format
			const reels = data.items.map((video, idx) => ({
				id: `yt_${video.id.videoId}_${searchQuery}_${page}_${idx}_${Date.now()}`,
				videoId: video.id.videoId,
				videoUrl: `https://www.youtube.com/embed/${video.id.videoId}`,
				embedUrl: `https://www.youtube.com/embed/${video.id.videoId}?autoplay=1&mute=1&loop=1&playlist=${video.id.videoId}&controls=0&modestbranding=1&rel=0`,
				thumbnail: video.snippet.thumbnails.high.url,
				title: video.snippet.title,
				credits: video.snippet.channelTitle,
				description: video.snippet.description,
				publishedAt: video.snippet.publishedAt,
			}));

			const result = {
				success: true,
				reels,
				page,
				limit,
				query: searchQuery,
				total: data.pageInfo.totalResults,
				hasMore: true, // Always true with rotating queries
			};

			setCache(cacheKey, result);
			return c.json(result);
		} catch (error: any) {
			console.error("YouTube Shorts API error:", error);
			return c.json(
				{
					success: false,
					error: error.message,
					reels: [],
					hasMore: false,
				},
				500
			);
		}
	})

	// GET /api/reels/trending - Popular shorts
	.get("/trending", async (c) => {
		try {
			if (!YOUTUBE_API_KEY) {
				return c.json(
					{
						success: false,
						error: "YOUTUBE_API_KEY not configured",
						reels: [],
						hasMore: false,
					},
					500
				);
			}

			const page = parseInt(c.req.query("page") || "1");
			const limit = parseInt(c.req.query("limit") || "10");

			const cacheKey = `youtube_trending_${page}_${limit}`;
			const cached = getCached(cacheKey);
			if (cached) {
				return c.json(cached);
			}

			// Get most popular shorts in tech category
			const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&order=viewCount&videoCategoryId=28&maxResults=${limit}&key=${YOUTUBE_API_KEY}`;

			const response = await fetch(apiUrl);

			if (!response.ok) {
				throw new Error(`YouTube API error: ${response.status}`);
			}

			const data = (await response.json()) as YouTubeSearchResponse;

			const reels = data.items.map((video, idx) => ({
				id: `yt_trending_${video.id.videoId}_${page}_${idx}_${Date.now()}`,
				videoId: video.id.videoId,
				videoUrl: `https://www.youtube.com/embed/${video.id.videoId}`,
				embedUrl: `https://www.youtube.com/embed/${video.id.videoId}?autoplay=1&mute=1&loop=1&playlist=${video.id.videoId}&controls=0&modestbranding=1&rel=0`,
				thumbnail: video.snippet.thumbnails.high.url,
				title: video.snippet.title,
				credits: video.snippet.channelTitle,
				description: video.snippet.description,
				publishedAt: video.snippet.publishedAt,
			}));

			const result = {
				success: true,
				reels,
				page,
				limit,
				category: "trending",
				hasMore: true,
			};

			setCache(cacheKey, result);
			return c.json(result);
		} catch (error: any) {
			console.error("YouTube Trending API error:", error);
			return c.json(
				{
					success: false,
					error: error.message,
					reels: [],
					hasMore: false,
				},
				500
			);
		}
	});

export default reelsRoutes;
