import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import LandingPage from "../components/LandingPage";
import Workspace from "../components/Workspace";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const [view, setView] = useState<"landing" | "app">("landing");
    const { isAuthenticated, isLoading } = useAuth0();
    const navigate = useNavigate();

    useEffect(() => {
        if (view === "app" && !isLoading && !isAuthenticated) {
            navigate({ to: "/login" });
        }
    }, [view, isLoading, isAuthenticated, navigate]);

	if (view === "landing") {
		return <LandingPage onEnter={() => setView("app")} />;
	}

    if (isLoading) {
        return <div className="min-h-screen bg-[#000000] flex items-center justify-center text-cyan-400">Loading Workspace...</div>;
    }

    if (!isAuthenticated) return null; // Will redirect via useEffect

	return <Workspace onBack={() => setView("landing")} />;
}

export default Index;
