import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { alphaTab } from "@coderline/alphatab-vite";

const isNodeModulePackage = (id: string, packageName: string) =>
  id.includes(`/node_modules/${packageName}/`);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), alphaTab()],
  base: "/MelodicaTrainer/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            isNodeModulePackage(id, "opensheetmusicdisplay") ||
            isNodeModulePackage(id, "vexflow")
          ) {
            return "osmd";
          }

          if (
            isNodeModulePackage(id, "jszip") ||
            isNodeModulePackage(id, "pako")
          ) {
            return "jszip";
          }
        },
      },
    },
  },
});
