# Strategies & chat

The window has two sides: the **chat** on the left, the **selected strategy** and its results on the right. Drag the
line between them to resize; double-click it to reset; drag it to the left edge (or use the button at the top left) to
hide the chat.

## Creating a strategy

Press **New strategy** and describe it in plain words: how it enters, exits, where the stop goes, filters, sessions.
Anything missing, the AI asks or proposes. Optionally give it a name (letters, digits and underscores), and tick
**Backtest it right away**, otherwise it is only written and compiled.

You can also just ask in the chat: *"make a London breakout on EURUSD M15 with a 1:2 target"*.

Each strategy is a folder with two files, which the AI writes and you can read in the **Code** tab:

```
strategies/<name>/<name>.mq5    the Expert Advisor (MQL5 source)
strategies/<name>/tester.ini    its test settings (symbol, timeframe, dates…)
```

Switch strategies with the selector at the top of the results panel. New strategies appear there as soon as the AI
creates them.

## What the AI can do

The AI works in the app's workspace folder only. It can:

- read and write strategy files;
- **compile** a strategy (MetaEditor) and fix its errors;
- **backtest** it and read the stats it gets back;
- **start or stop live trading**, but only when you explicitly ask in that message. With an API key, the app also asks
  you to confirm in the chat first.

It cannot run other programs or touch files outside the workspace. Every strategy it writes uses the shared
[risk module](./risk-rules), so position size and account rules are the same inputs everywhere, and session times go
through the [time-zone module](./broker-time).

After a backtest it gives a short read of the result (net profit, profit factor, drawdown, trade count, rule breaches)
and suggests one next step.

## Conversations

The icon at the top of the chat opens your conversations: start a new one, switch, or delete. Each conversation
remembers its AI session, so you can come back to it later. The model and effort picker sits next to **Send** and
applies to your next message.

## Strategy inputs

Every choice in a strategy (periods, bands, the risk-reward ratio…) is an MQL5 `input` with a plain-words label. The
app turns them into fields under **Strategy** in the settings panel, so you can change them without editing code;
**Run again** tests with the new values. Technical inputs (magic number, broker time offsets) sit under **Advanced**,
folded away.
