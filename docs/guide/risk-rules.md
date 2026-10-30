# Risk & rules

Every strategy shares one risk module, so the same **Risk & rules** inputs appear on all of them. They size each trade
and enforce account limits, in backtests and live. Nothing is specific to one firm: a prop-firm challenge, a funded
account or your own account is just a set of these values.

## Position size

| Input | Meaning |
|---|---|
| **Position size** | *% of balance per trade*, *Fixed money per trade*, or *Fixed lots*. |
| Risk per trade, % | With % mode: how much of the balance a trade loses if it hits its stop. |
| Risk per trade, money | With money mode: the same, as an amount. |
| Fixed lots | With lots mode: always this size. |

Sizing works from the distance to the stop loss, so **every trade needs a stop**. A trade with no stop, or a stop so
wide that even the minimum lot risks too much, is skipped.

## Account rules

| Input | Meaning |
|---|---|
| Account size | What the % limits refer to. 0 = the balance at the start. |
| **Daily loss limit, %** | How much may be lost in one day. 0 = off. |
| Daily limit is a % of | The *account size*, or *the day-start value*. |
| Day-start value | *Balance*, *Equity*, or the *higher of the two* at the start of the day. |
| Day resets at | The broker-server hour when a new day starts (many firms reset at midnight server time). |
| **Max loss limit, %** | How far the account may fall in total. 0 = off. |
| Max loss type | *Static* (from the account size), *Trailing* (from the highest equity reached), or *Trailing until it reaches the account size* (then it stays there). |
| Stop trading this close to a limit | A safety buffer, as a % of the limit: at 20 %, trading stops when 80 % of the limit is used. |
| Close positions when stopping | Also close open trades when a limit stops trading. |
| **Profit target, %** | The goal. 0 = none. |
| Stop trading once the target is reached | For challenges: stop once passed. |
| Max new trades per day | 0 = no limit. |

Floating losses count: limits watch equity, not only closed trades.

### Example: a typical two-step challenge

Account size 100 000, daily loss 5 % of the day-start value (higher of balance and equity), max loss 10 % static,
profit target 10 %, stop at target. Check your firm's exact rules: whether the daily limit uses balance or equity,
when its day resets, and whether the max loss trails.

## Rule profiles

Set the rules once, then save them as a **profile** in the Risk & rules panel and pick it on any strategy. The summary
line (for example *1.0% per trade · no account limits*) shows what's active while the panel is folded.

## The rules check

In a backtest the risk module writes one line per day (balance and equity at the start, the lowest and highest equity,
the close, trades). After the test the app checks that log against the rules the run used and shows:

- **passed** or **breached**, and on which day;
- the worst day, as a % of the daily limit;
- how deep the account went against the max loss;
- whether and when the profit target was reached.

Within one day the tester doesn't say whether the high or the low came first, so for trailing limits the day's own
high only counts from the next day: the lenient reading. Leave some margin.
