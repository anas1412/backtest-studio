# FAQ

## Does it need an internet connection?

For the AI, yes (unless you use a local model through Ollama or another local server). Backtests run entirely on your
computer, in your MT5; MT5 itself connects to your broker for prices and history.

## Is my data sent anywhere?

Your messages and the strategy files the AI reads go to the AI you chose (or its provider). API keys only go to their
own provider. Nothing else leaves your computer: there's no account, no telemetry, no cloud.

## Which brokers and prop firms work?

Any broker or firm that gives you an MT5 account. The risk rules are generic: set the values your firm uses
([Risk & rules](../guide/risk-rules)), and set your broker's server-time offset on strategies that use session times
([Broker time & DST](../guide/broker-time)).

## Can I use my own EAs?

Yes. Put the `.mq5` in a new folder under `workspace/strategies/<name>/<name>.mq5` with a `tester.ini`, or ask the AI to
adapt it. To get the app's risk sizing and rules check, it needs the shared risk module; the AI can add it.

## MetaTrader 4?

No. Only MetaTrader 5 (MQL5 and its Strategy Tester).

## macOS?

Not yet. The app itself could run there, but MT5 on a Mac runs in a Wine wrapper the app doesn't look for.

## Is a good backtest a promise?

No. A backtest shows how the rules would have traded the past, with the broker's recorded spreads and the tick model you
chose. Slippage, changing spreads, news and your broker's execution differ live. Test on a demo account before risking
money.

## Is it free?

Yes, and the source is on [GitHub](https://github.com/anas1412/backtest-studio). The AI you use may cost money (a
subscription or API usage).
