import { defineConfig } from "vitepress";

export default defineConfig({
  title: "VibeAI Router",
  description: "OpenAI-compatible gateway to free AI models",
  outDir: "./dist",
  themeConfig: {
    logo: "/favicon.ico",
    nav: [
      { text: "Home", link: "/" },
      { text: "Demo", link: "/demo/chat" },
      { text: "API Reference", link: "/reference" },
    ],
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/cup113/VibeAIRouter",
      },
    ],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Jason Li",
    },
  },
  vite: {
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
});
