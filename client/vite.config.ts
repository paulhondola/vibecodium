import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
	plugins: [
		// Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
		tailwindcss(),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	optimizeDeps: {
		// monaco-emacs uses AMD (define/require) internally which is incompatible with
		// Vite's ESM pre-bundler. Excluding it prevents the "define is not defined" crash.
		exclude: ["monaco-emacs"],
	},
});

