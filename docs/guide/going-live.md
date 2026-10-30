# Going live

When a strategy is ready, the app can start it on your MT5 account. **Try it on a demo account first.**

## Starting

Press **Go live** next to the run button. The sheet shows:

- the strategy, symbol and timeframe, and its inputs (including Risk & rules) as they are now;
- the **account and server** it will trade on, and whether that server is a **demo** server.

Slide to confirm. The app compiles the strategy, then starts MT5 with the strategy on a chart, its inputs loaded and
**Algo Trading** switched on. If MT5 can't log in (expired account, wrong server), it stops and tells you why.

From then on **MT5 trades it by itself**. The AI isn't involved and the app doesn't need to stay open. Risk & rules are
enforced by the strategy inside MT5, exactly as in the backtest.

You can also ask in the chat: *"run it live"*. The AI only starts or stops live trading when you ask in that message,
and says which account it will use first.

::: warning Demo servers aren't always free demos
Prop firms often run paid challenge and funded accounts on servers named "demo". The badge tells you the server type,
not whether the account is a free one: check which account is selected before you slide.
:::

## While it trades

- A **LIVE** pill in the title bar and a banner on the strategy show what is running and where.
- **Journal** shows MT5's messages: login, the strategy loading, orders and deals.
- Backtests are refused while live trading runs: MT5 allows one running copy per install. Install MT5 a second time
  (another folder or Wine prefix) if you want to test and trade at the same time.

## Stopping

Press **Stop** on the banner, or ask the AI. The app closes MT5, which stops the strategy. **Open positions stay open**
on the broker's side: close them in MT5 if you want them closed.
