# Commands

These are the only commands the AI may run. They live in the workspace's `tools/` folder and do the same as the app's
buttons.

::: code-group

```bat [Windows]
tools\compile.cmd <name>       :: compile only, prints errors and warnings
tools\backtest.cmd <name>      :: compile, then run the Strategy Tester; prints the key stats
tools\live.cmd start <name>    :: start trading it live in MT5
tools\live.cmd stop            :: stop live trading (closes MT5; positions stay open)
tools\live.cmd status          :: what is trading live, if anything
```

```sh [Linux]
tools/compile.sh <name>        # compile only, prints errors and warnings
tools/backtest.sh <name>       # compile, then run the Strategy Tester; prints the key stats
tools/live.sh start <name>     # start trading it live in MT5
tools/live.sh stop             # stop live trading (closes MT5; positions stay open)
tools/live.sh status           # what is trading live, if anything
```

:::

`<name>` is the strategy's folder name. The commands call the app's own executable, which the app passes to the AI
tools it starts (`STUDIO_BIN`). When you [run from source](./development), they call `bun server/cli.ts` instead, so you
can run them from a terminal in the workspace folder too.

## What a backtest prints

For example:

```
RUN 20260130-101500-london_breakout
Total Net Profit: 1250.40
Profit Factor: 1.42
Expected Payoff: 8.12
Total Trades: 154
Profit Trades (% of total): 81 (52.60%)
Equity Drawdown Maximal: 640.10 (5.80%)
Sharpe Ratio: 1.9
Recovery Factor: 1.95
History Quality: 100%
Matched trades: 154
Account rules: PASSED; daily loss worst 2.10% of 5% limit (0 breach days); max loss worst 4.20% of 10%
```

If MT5 is open, the command says so and stops: close MT5 and run it again. If another backtest is running, it says so
instead of queuing.

## tester.ini

Each strategy's test settings, which the app's settings panel edits:

```ini
[Tester]
Symbol=XAUUSD
Period=H1                ; M1 M5 M15 M30 H1 H4 D1 ...
Model=1                  ; 0 every tick, 1 1-minute OHLC, 2 open prices, 4 real ticks
FromDate=2026.01.01
ToDate=2026.06.01
Deposit=10000
Currency=USD
Leverage=1:100

[TesterInputs]
InpFastPeriod=10
```

Only `[Tester]` settings and `[TesterInputs]` go here. The app fills in the rest (the expert, report path, shutdown,
visual and optimization flags) when it runs the test.
