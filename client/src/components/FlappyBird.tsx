import { useEffect } from "react";

interface FlappyBirdProps {
	onClose: () => void;
}

export default function FlappyBird({ onClose }: FlappyBirdProps) {
	useEffect(() => {
		const handler = (e: MessageEvent) => {
			if (e.data?.type === "GAME_EXIT") onClose();
		};
		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, [onClose]);

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#000",
			}}
		>
			<iframe
				src="/flappy-bird/index.html"
				style={{
					width: "100%",
					height: "100%",
					border: "none",
					display: "block",
				}}
				title="Flappy Bird"
				allow="gamepad"
			/>
		</div>
	);
}
