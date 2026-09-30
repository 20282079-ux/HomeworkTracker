import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    hmr: false,
    // Freebuff's managed preview injects PORT; fall back to Vite's default.
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
    // Freebuff's sandbox injects env vars via the shell. Inline them into
    // `import.meta.env` so they are also available in the production build.
    define: {
      "import.meta.env.VITE_FREEBUFF_PORT": JSON.stringify(process.env.PORT || "8123"),
    },
  },
});
