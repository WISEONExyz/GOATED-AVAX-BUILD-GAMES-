import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@walletconnect") || id.includes("@reown") || id.includes("w3m-modal")) {
            return "walletconnect";
          }
          if (id.includes("ethers")) {
            return "ethers";
          }
          if (id.includes("react") || id.includes("scheduler")) {
            return "react-vendor";
          }
        }
      }
    }
  }
});
