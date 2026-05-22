import { defineConfig } from "vite";
import { createViteConfig } from "./shared/viteConfig";

export default defineConfig(({ mode }) => createViteConfig(mode));
