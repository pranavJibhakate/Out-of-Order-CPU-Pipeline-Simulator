import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/Out-of-Order-CPU-Pipeline-Simulator/",
});
