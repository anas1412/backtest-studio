# AI engines & API keys

The chat can run on an AI tool you already have installed, or on an API key. Open the picker next to **Send** to choose
the engine, the model and (where the model supports it) the effort. *Engines & API keys* (also the gear in the title
bar) shows what was found and where keys are added.

## AI tools found on your computer

If one of these is installed and signed in, it appears by itself. The app runs it inside its workspace folder with
limited permissions: it may edit files there and run the app's three commands (compile, backtest, live), nothing else.

| Tool | Notes |
|---|---|
| **Claude Code** | Uses your Claude subscription or key. Models and effort levels selectable. Permissions passed as an allow-list. |
| **opencode** | Uses whatever providers you configured in opencode. Permissions come from the workspace's `opencode.json` (shell limited to the app's commands, no web access). |
| **Gemini CLI** | Headless mode with file edits and the app's commands allowed. Works with a Gemini API key. |
| **Codex CLI** | Runs in Codex's workspace-write sandbox. Codex can only limit *where* it writes, not which commands it runs. |

Install them the usual way for your OS (each tool's own instructions); the app looks on your `PATH` and in each tool's
default install folder. Restart the app after installing one.

All of them read the same instructions (`AGENTS.md` in the workspace), so they write strategies the same way.

## API keys

No AI tool installed? Add a key instead. The app then runs its own built-in agent, with the same abilities and limits,
on any of these:

| Provider | Where to get a key |
|---|---|
| Anthropic | console.anthropic.com → API keys |
| OpenAI | platform.openai.com → API keys |
| Google Gemini | aistudio.google.com → Get API key |
| DeepSeek | platform.deepseek.com → API keys |
| OpenRouter | openrouter.ai → Keys (one key, many models) |
| OpenAI-compatible | Any OpenAI-style API (Groq, Mistral, xAI, Together, LM Studio…): its base URL ending in `/v1`, and a key if it needs one |
| Ollama | Models on your own computer: the base URL, `http://127.0.0.1:11434` by default |

Adding a key lists the provider's models, which also tests the key. With an API key, starting or stopping live trading
asks you to confirm in the chat.

If the usual environment variable is set (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`,
`OPENROUTER_API_KEY`), that key is used without adding it.

### Where keys are stored

In `workspace/.studio/keys.json` inside the app's data folder ([Files & folders](../reference/files)): on Windows that's
in your own user profile, on Linux the file is readable only by your user. The app shows them masked and never writes them to logs. They are only sent to the provider they belong to.
