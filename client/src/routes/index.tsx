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
    const [projectId, setProjectId] = useState<string | null>(null);
    const { isAuthenticated, isLoading } = useAuth0();
    const navigate = useNavigate();

    useEffect(() => {
        if (view === "app" && !isLoading && !isAuthenticated) {
            navigate({ to: "/login" });
        }
    }, [view, isLoading, isAuthenticated, navigate]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const projectParam = params.get("project");
        if (projectParam && view === "landing") {
            setProjectId(projectParam);
            setView("app");
        }
    }, [view]);

	if (view === "landing") {
		return <LandingPage onEnter={(pid?: string) => {
            if (pid) setProjectId(pid);
            setView("app");
        }} />;
	}

    if (isLoading) {
        return <div className="min-h-screen bg-[#000000] flex items-center justify-center text-cyan-400">Loading Workspace...</div>;
    }

    if (!isAuthenticated) return null; // Will redirect via useEffect

	return <Workspace projectId={projectId} onBack={() => { setView("landing"); setProjectId(null); }} />;
}

export default Index;
