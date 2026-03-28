import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Auth0Provider } from "@auth0/auth0-react";
import "./index.css";

const queryClient = new QueryClient();

// Add global handler to suppress harmless React 18 Strict Mode unmount cancelation errors from Monaco
window.addEventListener("unhandledrejection", (event) => {
    if (event.reason && event.reason.type === "cancelation") {
        event.preventDefault();
    }
});

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error(
		"Root element not found. Check if it's in your index.html or if the id is correct.",
	);
}

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

if (!domain || !clientId) {
    throw new Error(
        "Critical Configuration Error: VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID must be provided in the frontend .env file."
    );
}

// Render the app
if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<StrictMode>
			<Auth0Provider
                domain={domain}
                clientId={clientId}
                authorizationParams={{
                    redirect_uri: window.location.origin,
                }}
                cacheLocation="localstorage"
                onRedirectCallback={(appState) => {
                    // After Auth0 returns, navigate back to the URL the user was on
                    // before the login redirect (which includes ?w= if set).
                    const returnTo = appState?.returnTo;
                    if (returnTo) {
                        const url = new URL(returnTo);
                        const w = url.searchParams.get("w");
                        router.navigate({ to: "/", search: { w: w ?? undefined }, replace: true });
                    } else {
                        router.navigate({ to: "/", search: { w: undefined }, replace: true });
                    }
                }}
            >
				<QueryClientProvider client={queryClient}>
					<RouterProvider router={router} />
				</QueryClientProvider>
			</Auth0Provider>
		</StrictMode>,
	);
}
