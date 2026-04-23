import react from "@vitejs/plugin-react";
import wyw from "@wyw-in-js/vite";
import { defineConfig } from "vite";

export default defineConfig({
	base: "/thread-visualizer/",
	plugins: [
		wyw({
			babelOptions: {
				presets: [
					["@babel/preset-typescript", { allExtensions: true, isTSX: true }],
					["@babel/preset-react", { runtime: "automatic" }],
				],
			},
		}),
		react(),
	],
});
