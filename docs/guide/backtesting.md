# Backtesting

Backtests run in **your** MetaTrader 5 Strategy Tester, on your broker's symbols and price history. The app starts MT5
in the background, runs the test, reads the report and shows it. MT5 must be closed while it does
([why](./first-start#_2-the-account)).

## Test settings

The panel under the strategy name holds its test settings. They're saved in the strategy's `tester.ini`, so the AI and
you always test the same way.

| Setting | What it does |
|---|---|
| **Symbol** | Any symbol your broker offers, with search. The ↻ button reads the list (and spreads) from MT5 again. |
| **Timeframe** | M1 to MN1. All timeframes are built from the same M1 history, so any works for a symbol with history. |
| **Tick model** | *Real ticks* (the broker's recorded ticks and spread, most accurate, slowest), *Every tick* (generated from M1), *1-minute OHLC* (4 prices per M1 bar; fast, good for logic on closed bars), *Open prices* (fastest; only for logic at the open of a bar). |
| **Dates** | Quick ranges ending today: last month, 3 or 6 months, year to date, last 1, 2, 3 or 5 years, *All history* (from the symbol's first year of downloaded history). Or pick any custom range. |
| **Deposit** | Starting balance, in the account currency. |

**Spread:** the tester uses the spread your broker recorded for each bar; MT5 doesn't let a test override it. The
average spread of a run is shown next to its date.

Below the settings are the strategy's **Risk & rules** ([details](./risk-rules)) and its **Strategy** inputs. The run
button says **Run backtest** the first time, **Run with these** after you change something, **Run again** otherwise.

## While it runs

A progress view replaces the results: **Compile** (MetaEditor) → **Test** (Strategy Tester) → **Report** (reading the
results) → **Chart data** (exporting the bars for the chart). The title bar badge shows *Backtesting…*. Only one test
runs at a time.

## Results

- **Stats:** net profit, profit factor, win rate, max drawdown, each with a small trend across this strategy's runs.
- **Account rules check:** when rules are set, whether the run passed or breached them, the worst day, and if the
  profit target was reached ([details](./risk-rules#the-rules-check)).
- **Chart:** price candles with every entry and exit, and the equity curve.
- **Trades:** every trade with side, lots, entry and exit time and price, result and balance; sort and filter by side or
  win/loss.
- **Code:** the strategy's source files.
- **Report:** MT5's tester log.

## Run history

Every backtest is kept. The **runs** button next to the strategy opens its history, newest first. Each run keeps the
code and settings it used, so you can go back to any of them and compare.
