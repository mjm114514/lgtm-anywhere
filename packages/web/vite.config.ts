import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // ES2021+ supports ||= (logical OR assignment). Without this, Rollup
    // down-levels ||= into a pattern that drops the variable declaration,
    // causing "i is not defined" inside xterm.js requestMode.
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          xterm: ["@xterm/xterm", "@xterm/addon-fit", "@xterm/addon-web-links"],
          markdown: ["react-markdown", "remark-gfm"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
});
