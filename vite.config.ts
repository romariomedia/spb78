import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * viteSingleFile() убран намеренно: он инлайнил ВЁСЬ JS/CSS в index.html,
 * из-за чего code splitting физически не работал и мобильный клиент грузил
 * карту, админку и Firebase до первого кадра. Теперь чанки раздельные,
 * а Vite сам расставляет modulepreload.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    target: "es2020",
    sourcemap: false,
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // node_modules проверяется ПОСЛЕДНИМ: иначе всё схлопнется в один vendor
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]react-dom[\\/]|[\\/]scheduler[\\/]|[\\/]react[\\/]/.test(id)) return "react";
          if (/@capacitor/.test(id)) return "capacitor";
          if (/leaflet/.test(id)) return "maps";
          if (/firebase|@firebase|@grpc|protobufjs/.test(id)) return "firebase";
          if (/framer-motion|motion-dom|motion-utils/.test(id)) return "anim";
          if (/react-virtuoso/.test(id)) return "virtuoso";
          if (/lucide-react/.test(id)) return "icons";
          if (/canvas-confetti/.test(id)) return "confetti";
          if (/@vkid/.test(id)) return "vkid";
          return "vendor";
        },
      },
    },
  },
});
