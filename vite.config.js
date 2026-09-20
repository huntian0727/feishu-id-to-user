import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    base: "./",
    plugins: [react()],
    server: {
        host: "0.0.0.0",
        proxy: {
            "/api": {
                target: "http://localhost:3001",
                changeOrigin: true,
            },
        },
    },
    build: {
        rollupOptions: {
            external: ["#minpath", "#minproc", "#minurl"],
        },
    },
});
