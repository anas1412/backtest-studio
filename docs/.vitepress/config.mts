import { defineConfig } from "vitepress";

const repo = "https://github.com/anas1412/backtest-studio";

export default defineConfig({
  title: "Backtest Studio",
  description: "Describe a trading strategy; an AI writes it for MetaTrader 5, backtests it and shows the results.",
  base: "/backtest-studio/",
  cleanUrls: true,
  lastUpdated: true,
  appearance: "dark",
  head: [["link", { rel: "icon", type: "image/png", href: "/backtest-studio/logo.png" }]],
  themeConfig: {
    logo: "/logo.png",
    nav: [
      { text: "Guide", link: "/guide/install" },
      { text: "Reference", link: "/reference/files" },
      { text: "Changelog", link: "/changelog" },
      { text: "Download", link: `${repo}/releases/latest` },
    ],
    sidebar: [
      {
        text: "Getting started",
        items: [
          { text: "Install", link: "/guide/install" },
          { text: "First start", link: "/guide/first-start" },
        ],
      },
      {
        text: "Using the app",
        items: [
          { text: "Strategies & chat", link: "/guide/strategies" },
          { text: "Backtesting", link: "/guide/backtesting" },
          { text: "Risk & rules", link: "/guide/risk-rules" },
          { text: "Broker time & DST", link: "/guide/broker-time" },
          { text: "Going live", link: "/guide/going-live" },
          { text: "AI engines & API keys", link: "/guide/ai-engines" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Files & folders", link: "/reference/files" },
          { text: "Commands", link: "/reference/commands" },
          { text: "Troubleshooting", link: "/reference/troubleshooting" },
          { text: "FAQ", link: "/reference/faq" },
        ],
      },
      {
        text: "Development",
        items: [
          { text: "Build from source", link: "/reference/development" },
          { text: "Releasing", link: "/reference/releasing" },
        ],
      },
      { text: "Changelog", link: "/changelog" },
    ],
    socialLinks: [{ icon: "github", link: repo }],
    editLink: { pattern: `${repo}/edit/main/docs/:path`, text: "Edit this page on GitHub" },
    search: { provider: "local" },
    outline: "deep",
  },
});
