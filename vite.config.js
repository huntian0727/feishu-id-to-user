import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
    base: command === "serve" ? "/" : "./",
    plugins: [react()],
    server: {
        host: "0.0.0.0",
    },
    build: {
        rollupOptions: {
            external: ["#minpath", "#minproc", "#minurl"],
        },
    },
}));
