import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  base: "/",
  appType: "spa",
  define: {
    global: "globalThis",
  },

  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },

  server: {
    host: true,
    port: 5173,
    strictPort: false,
    // Dev tunnels (e.g. cloudflared) without editing this file each time
    allowedHosts: true,
  },

  preview: {
    host: true,
    port: 4173,
    strictPort: false,
    allowedHosts: true,
  },

  build: {
    target: "es2020",
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
    cssMinify: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 700,
    modulePreload: { polyfill: true },
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
  },
}));
