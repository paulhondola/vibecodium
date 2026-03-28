import { X, Volume2, VolumeX, Loader2, Minimize2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface Reel {
	id: string;
	videoId?: string;
	videoUrl: string;
	embedUrl?: string;
	thumbnail: string;
	title: string;
	credits: string;
	duration?: number;
	description?: string;
}

interface ReelsWidgetProps {
	onClose: () => void;
	onMinimize?: () => void;
	isAgentLoading?: boolean;
}

export default function ReelsWidget({ onClose, onMinimize, isAgentLoading = true }: ReelsWidgetProps) {
	const [reels, setReels] = useState<Reel[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [isMuted, setIsMuted] = useState(true);
	const [isMinimized, setIsMinimized] = useState(false);
	const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);

	const containerRef = useRef<HTMLDivElement>(null);
	const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
	const observerRef = useRef<IntersectionObserver | null>(null);
	const wasLoadingRef = useRef(isAgentLoading);

	// Fetch reels from backend
	const fetchReels = useCallback(async (page: number) => {
		if (isLoading) return;
		if (page > 1 && !hasMore) return;

		setIsLoading(true);
		try {
			const res = await fetch(`http://localhost:3000/api/reels?page=${page}&limit=5`);
			const data = await res.json();

			if (data.success) {
				// If page 1, replace instead of append to prevent duplicates on remount
				if (page === 1) {
					setReels(data.reels);
				} else {
					setReels(prev => [...prev, ...data.reels]);
				}
				setHasMore(data.hasMore);
				setCurrentPage(page);
			}
		} catch (err) {
			console.error("Failed to fetch reels:", err);
		} finally {
			setIsLoading(false);
		}
	}, [isLoading, hasMore]);

	// Initial fetch
	useEffect(() => {
		fetchReels(1);
	}, []);

	// Auto-minimize when agent transitions from loading → finished
	useEffect(() => {
		// Only auto-minimize if we transition from true → false (agent just finished)
		if (wasLoadingRef.current === true && isAgentLoading === false && !isMinimized) {
			// Wait 1 second then auto-minimize
			const timer = setTimeout(() => {
				setIsMinimized(true);
				onMinimize?.();
			}, 1000);

			wasLoadingRef.current = isAgentLoading;
			return () => clearTimeout(timer);
		}
		wasLoadingRef.current = isAgentLoading;
	}, [isAgentLoading, isMinimized, onMinimize]);

	// IntersectionObserver for autoplay and tracking visible reel
	useEffect(() => {
		observerRef.current = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const element = entry.target as HTMLElement;
					const reelId = element.dataset.reelId;
					const reelIndex = element.dataset.reelIndex;

					if (!reelId) return;

					if (entry.isIntersecting && entry.intersectionRatio >= 0.75) {
						// Update current visible index
						if (reelIndex) {
							setCurrentVisibleIndex(parseInt(reelIndex));
						}

						// Find current reel index for infinite scroll
						const currentIndex = reels.findIndex(r => r.id === reelId);

						// Only handle direct video playback (not YouTube iframes)
						if (element instanceof HTMLVideoElement) {
							element.play().catch(() => {
								// Autoplay might be blocked, that's ok
							});

							// Preload next 2 videos
							for (let i = 1; i <= 2; i++) {
								const nextReel = reels[currentIndex + i];
								if (nextReel && !nextReel.videoId) { // Only preload direct videos
									const nextVideo = videoRefs.current.get(nextReel.id);
									if (nextVideo) {
										nextVideo.load();
									}
								}
							}
						}

						// Infinite scroll: load more when near bottom
						if (currentIndex >= reels.length - 3 && hasMore && !isLoading) {
							fetchReels(currentPage + 1);
						}
					} else {
						// Video not visible - pause it (only for direct videos)
						if (element instanceof HTMLVideoElement) {
							element.pause();
						}
					}
				});
			},
			{
				root: containerRef.current,
				threshold: [0, 0.25, 0.5, 0.75, 1.0],
			}
		);

		// Observe all videos
		videoRefs.current.forEach((video) => {
			observerRef.current?.observe(video);
		});

		return () => {
			observerRef.current?.disconnect();
		};
	}, [reels, currentPage, hasMore, isLoading, fetchReels]);

	// Esc key to close
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	const handleVideoRef = (reelId: string, el: HTMLVideoElement | HTMLDivElement | null) => {
		if (el) {
			videoRefs.current.set(reelId, el as HTMLVideoElement);
			observerRef.current?.observe(el);
		} else {
			const video = videoRefs.current.get(reelId);
			if (video) {
				observerRef.current?.unobserve(video);
				videoRefs.current.delete(reelId);
			}
		}
	};

	const toggleMute = () => {
		const newMutedState = !isMuted;
		setIsMuted(newMutedState);

		// Apply to all direct videos
		videoRefs.current.forEach((video) => {
			if (video instanceof HTMLVideoElement) {
				video.muted = newMutedState;
			}
		});

		// Force refresh YouTube iframes with new mute state
		// (YouTube embeds need src change to update mute param)
		setReels(prev => [...prev]);
	};

	if (isMinimized) {
		return (
			<button
				onClick={() => setIsMinimized(false)}
				className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white px-4 py-2 rounded-full shadow-lg hover:scale-105 transition-transform flex items-center gap-2 font-semibold text-sm"
			>
				<span className="text-xs">🔥</span>
				Vibe Reels
			</button>
		);
	}

	return (
		<div className="fixed top-12 right-0 bottom-0 z-50 flex flex-col items-center bg-[#18181b] border-l border-[#27272a] shadow-[-10px_0_30px_rgba(0,0,0,0.5)] w-[380px] animate-in slide-in-from-right duration-300">
			{/* Header */}
			<div className="w-full flex justify-between items-center px-4 py-3 shrink-0 border-b border-[#27272a]">
				<div className="flex items-center gap-3">
					<h2 className="text-white font-semibold flex items-center gap-2">
						<span className="bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-transparent bg-clip-text">
							Vibe Reels
						</span>
					</h2>
					{isAgentLoading && (
						<span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
							Loading...
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={toggleMute}
						className="text-gray-400 hover:text-white transition-colors bg-[#27272a] hover:bg-[#3f3f46] rounded-full p-1.5"
					>
						{isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
					</button>
					<button
						onClick={() => setIsMinimized(true)}
						className="text-gray-400 hover:text-white transition-colors bg-[#27272a] hover:bg-[#3f3f46] rounded-full p-1.5"
					>
						<Minimize2 size={16} />
					</button>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-white transition-colors bg-[#27272a] hover:bg-[#3f3f46] rounded-full p-1.5"
					>
						<X size={16} />
					</button>
				</div>
			</div>

			{/* Scrollable Video Container */}
			<div
				ref={containerRef}
				className="flex-1 w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth"
				style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
			>
				<style>{`
					.reels-container::-webkit-scrollbar {
						display: none;
					}
				`}</style>

				{reels.map((reel, index) => {
					// Only render YouTube iframe if it's the current visible one or adjacent ones
					const shouldRenderYouTube = !reel.videoId || Math.abs(index - currentVisibleIndex) <= 1;

					return (
						<div
							key={`${reel.id}_${index}`}
							ref={(el) => reel.videoId ? handleVideoRef(reel.id, el) : null}
							data-reel-id={reel.id}
							data-reel-index={index}
							className="snap-start snap-always h-full w-full relative flex items-center justify-center bg-black"
						>
							{reel.videoId ? (
								shouldRenderYouTube ? (
									// YouTube embed - only render if visible or adjacent
									<iframe
										key={`iframe_${index}_${currentVisibleIndex}`}
										src={`https://www.youtube.com/embed/${reel.videoId}?autoplay=${index === currentVisibleIndex ? 1 : 0}&mute=${isMuted ? 1 : 0}&loop=1&playlist=${reel.videoId}&controls=1&modestbranding=1&rel=0&enablejsapi=1`}
										className="w-full h-full border-none"
										allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
										allowFullScreen
										title={reel.title}
									/>
								) : (
									// Placeholder with thumbnail for off-screen reels
									<div className="w-full h-full flex items-center justify-center bg-black">
										<img src={reel.thumbnail} alt={reel.title} className="w-full h-full object-contain" />
									</div>
								)
							) : (
								// Direct video file
								<video
									ref={(el) => handleVideoRef(reel.id, el)}
									data-reel-id={reel.id}
									src={reel.videoUrl}
									poster={reel.thumbnail}
									loop
									muted={isMuted}
									playsInline
									preload="metadata"
									className="w-full h-full object-contain"
								/>
							)}

							{/* Video Info Overlay */}
							<div className="absolute bottom-4 left-4 right-4 text-white pointer-events-none">
								<h3 className="font-bold text-sm drop-shadow-lg line-clamp-2 bg-black/50 px-2 py-1 rounded">{reel.title}</h3>
								<p className="text-xs text-gray-300 drop-shadow-lg bg-black/50 px-2 py-0.5 rounded mt-1">{reel.credits}</p>
							</div>
						</div>
					);
				})}

				{/* Loading Indicator */}
				{isLoading && (
					<div className="snap-start h-full w-full flex items-center justify-center bg-[#09090b]">
						<div className="flex flex-col items-center gap-3">
							<Loader2 className="animate-spin text-pink-500" size={32} />
							<span className="text-sm text-gray-400">Loading more vibes...</span>
						</div>
					</div>
				)}

				{/* End of Feed */}
				{!hasMore && reels.length > 0 && (
					<div className="snap-start h-full w-full flex items-center justify-center bg-gradient-to-b from-[#09090b] to-purple-900/20">
						<div className="text-center">
							<p className="text-gray-400 text-sm">You've reached the end!</p>
							<button
								onClick={() => {
									setReels([]);
									setCurrentPage(1);
									setHasMore(true);
									fetchReels(1);
								}}
								className="mt-4 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full text-sm font-semibold hover:scale-105 transition-transform"
							>
								Start Over
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
