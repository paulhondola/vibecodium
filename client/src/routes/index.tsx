import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthProvider";
import LandingPage from "../components/LandingPage";
import Workspace from "../components/Workspace";

export const Route = createFileRoute("/")({
	component: Index,
    validateSearch: (search: Record<string, unknown>) => {
        return { w: search.w as string | undefined };
    }
});

function Index() {
    const { w } = Route.useSearch();
    // Derive view directly from URL so navigations (OAuth callback, shared links)
    // are reflected immediately without stale state.
    const view: "landing" | "app" = w ? "app" : "landing";
    const [projectId, setProjectId] = useState<string | null>(w ?? null);
    const [manualApp, setManualApp] = useState(false); // entered without a ?w= URL
    const { isAuthenticated, isLoading, loginWithRedirect } = useAuth();
    const navigate = useNavigate();

    // Keep projectId in sync when ?w= changes (OAuth restore, shared link navigation)
    useEffect(() => {
        if (w && w !== projectId) {
            setProjectId(w);
        }
    }, [w]);

    const inApp = view === "app" || manualApp;

    useEffect(() => {
        if (inApp && !isLoading && !isAuthenticated) {
            loginWithRedirect({
                appState: { returnTo: window.location.href },
            });
        }
    }, [inApp, isLoading, isAuthenticated, loginWithRedirect]);

    if (!inApp) {
        return <LandingPage onEnter={(pid?: string) => {
            if (pid) {
                setProjectId(pid);
                navigate({ to: "/", search: { w: pid } });
            } else {
                setManualApp(true);
            }
        }} />;
    }

    if (isLoading) {
        return <div className="min-h-screen bg-[#000000] flex items-center justify-center text-cyan-400">Loading Workspace...</div>;
    }

    if (!isAuthenticated) return null; // loginWithRedirect fires via useEffect

    return <Workspace projectId={projectId} onBack={() => {
        setManualApp(false);
        setProjectId(null);
        navigate({ to: "/", search: { w: undefined }, replace: true });
    }} />;
}

export default Index;
