import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import LandingPage from "../components/LandingPage";
import Workspace from "../components/Workspace";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const [view, setView] = useState<"landing" | "app">("landing");

	if (view === "landing") {
		return <LandingPage onEnter={() => setView("app")} />;
	}

	return <Workspace onBack={() => setView("landing")} />;
}

export default Index;
