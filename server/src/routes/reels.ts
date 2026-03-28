import { Hono } from "hono";

// Sample brainrot reels data (can be replaced with DB later)
// Using public test videos that allow hotlinking
const REELS_DATABASE = [
	{
		id: "1",
		videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
		thumbnail: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
		title: "Big Buck Bunny",
		credits: "Blender Foundation",
		duration: 15
	},
	{
		id: "2",
		videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
		thumbnail: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg",
		title: "Elephants Dream",
		credits: "Blender Foundation",
		duration: 12
	},
	{
		id: "3",
		videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
		thumbnail: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg",
		title: "For Bigger Blazes",
		credits: "Google",
		duration: 10
	},
	{
		id: "4",
		videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
		thumbnail: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg",
		title: "For Bigger Escapes",
		credits: "Google",
		duration: 14
	},
	{
		id: "5",
		videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
		thumbnail: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg",
		title: "For Bigger Fun",
		credits: "Google",
		duration: 20
	},
	{
		id: "6",
		videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
		thumbnail: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerJoyrides.jpg",
		title: "For Bigger Joyrides",
		credits: "Google",
		duration: 8
	},
	{
		id: "7",
		videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
		thumbnail: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerMeltdowns.jpg",
		title: "For Bigger Meltdowns",
		credits: "Google",
		duration: 11
	},
	{
		id: "8",
		videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
		thumbnail: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg",
		title: "Sintel",
		credits: "Blender Foundation",
		duration: 13
	},
	{
		id: "9",
		videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
		thumbnail: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/SubaruOutbackOnStreetAndDirt.jpg",
		title: "Subaru Outback",
		credits: "Google",
		duration: 16
	},
	{
		id: "10",
		videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
		thumbnail: "https://storage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg",
		title: "Tears of Steel",
		credits: "Blender Foundation",
		duration: 9
	}
];

const reelsRoutes = new Hono()
	// GET /api/reels?page=1&limit=5
	.get("/", (c) => {
		const page = parseInt(c.req.query("page") || "1");
		const limit = parseInt(c.req.query("limit") || "5");

		const startIndex = (page - 1) * limit;
		const endIndex = startIndex + limit;

		// Use sequential order with unique IDs per page to prevent duplicates
		const paginatedReels = REELS_DATABASE.slice(startIndex, endIndex).map((reel, idx) => ({
			...reel,
			id: `${page}_${reel.id}` // Unique ID per page to prevent React key conflicts
		}));

		return c.json({
			success: true,
			reels: paginatedReels,
			page,
			limit,
			total: REELS_DATABASE.length,
			hasMore: endIndex < REELS_DATABASE.length
		});
	});

export default reelsRoutes;
