---
layout: home

hero:
  name: Backtest Studio
  text: Trading ideas to tested MT5 strategies
  tagline: Describe a strategy in plain words. An AI writes it as an MQL5 Expert Advisor, backtests it in your own MetaTrader 5 and shows the results next to the chat. Windows and Linux.
  image:
    src: /logo.png
    alt: Backtest Studio
  actions:
    - theme: brand
      text: Download
      link: https://github.com/anas1412/backtest-studio/releases/latest
    - theme: alt
      text: Get started
      link: /guide/install
    - theme: alt
      text: GitHub
      link: https://github.com/anas1412/backtest-studio

features:
  - title: Any AI
    details: Claude Code, opencode, Gemini CLI or Codex if you have them, or an API key from Anthropic, OpenAI, Google, DeepSeek, OpenRouter, any OpenAI-compatible service or a local Ollama.
    link: /guide/ai-engines
  - title: Your own MetaTrader 5
    details: Backtests run in the MT5 you already use, with your broker's symbols, spreads and history. No cloud, no container.
    link: /guide/backtesting
  - title: Risk & prop-firm rules
    details: Risk per trade, daily and max loss (static or trailing), profit target, trades per day. Every backtest is checked against them. Any prop firm is just a set of these values.
    link: /guide/risk-rules
  - title: Session times done right
    details: London and New York sessions follow their own daylight-saving dates, converted to your broker's server time.
    link: /guide/broker-time
  - title: Go live
    details: When a strategy is ready, start it on your MT5 account from the app. MT5 trades it by itself.
    link: /guide/going-live
  - title: Windows and Linux
    details: A Windows installer and a Linux AppImage. The app updates itself from GitHub.
    link: /guide/install
---

![Backtest Studio: chat on the left, a backtest's chart and stats on the right](/screenshot.png)
