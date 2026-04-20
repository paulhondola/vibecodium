import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthProvider";
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

// Render the app
if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<StrictMode>
			<AuthProvider>
				<QueryClientProvider client={queryClient}>
					<RouterProvider router={router} />
				</QueryClientProvider>
			</AuthProvider>
		</StrictMode>,
	);
}
