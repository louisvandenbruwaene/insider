# Insider: design

Every number named here lives in `index.html` § 1 SETTINGS.

## The price is a deck, dealt over many days
- A stock is a deck of cards. NOVA (the starting stock) has 844 cards: `up/down/UP/DOWN` ×100, `bull/bear` ×10, `BULL/BEAR` ×1, and the same counts for the vol cards (`CARD_TYPES`, `TICKERS`).
- Price cards move the price by move × σ. Vol cards multiply σ (`volUP` ×1.05). σ starts each day at 1 and stays between `SIGMA_MINIMUM` and `SIGMA_MAXIMUM`.
- A day is `TICKS_PER_DAY` (90) ticks, one per `SECONDS_PER_TICK`. The cards are dealt from a **shoe**: the shuffled deck, which lasts several days (NOVA: about 9). Only when it runs out is the whole deck reshuffled. A BULL drawn this week is gone until the next shuffle, so the cards left in the shoe (the 🂠 DECK window) are long-term information.
- Positions are held overnight. Each day opens at yesterday's close × (1 + `INFLATION_PER_DAY`).
- Each stock joins the run with `HISTORY_DAYS` of history already dealt, so day 1 opens at `BASE_OPEN_PRICE` with a week behind it. Every owned stock trades every day, even the ones you're not trading.
- The deck is symmetric, so the average move per card is zero. Moves multiply, though, and +5% then −5% is −0.25%. The more σ there is, the more the price drifts down (volatility drag), against the 1% overnight inflation.
- Today is fixed at the open (`scheduleDay`), seeded by run, day and stock, so a reload gives the same cards.
- Deck edits in the shop change the shoe at once: removed copies come out of it, added copies are shuffled in.

## Event cards (bought in the shop, one copy at a time)
`earnings` (the next `EARNINGS_EXTRA_CARDS` cards land in the same second), `fed` (σ ×`FED_SIGMA_MULTIPLIER` for `FED_TICKS`), `halt` (price frozen `HALT_SECONDS`, trading still allowed), `momentum` (repeats the last price move), `squeeze` (+`SQUEEZE_MOVE` × σ).

## Fair market maker
The market maker knows the cards left in the shoe and what the whole deck holds, but not the order. Every `FORECAST_EVERY_TICKS` ticks it plays out the rest of today plus `FORECAST_DAYS_AHEAD` (7) more days `FORECAST_PATHS` times (`simulateForecast`). That gives:
- the chart's three numbers: the bottom 10%, the average and the top 10% of the close 7 days ahead. Nothing is shown for today's close: the insider tips are the only edge on today.
- option prices: an option expiring in k days is valued from the forecast of that day's close. Fair value = the average payoff, bought at +`OPTION_TRANSACTION_COST` and sold at −`OPTION_TRANSACTION_COST`.

Without information or a rigged deck, nothing has an edge. `node tools/sim.cjs fairness` checks the fair value against real payoffs, and `node tools/sim.cjs equivalence` checks that the fast simulator matches the real days exactly. An independent check over 1500 runs: a 7-day at-the-money call is priced at 21.6% of the strike and paid 19.0% ± 1.5%.

## Screen
- **Side menu:** the only place with numbers. It shows the day and clock, cash, the stock line `x × average price = buy-in` (negative when short) with its value now, each option lot the same way, equity, heat and the next meeting. "Now" lines are green for a profit and red for a loss, whether long or short.
- **Chart:** the previous week (thin grey), today (live), then three dashed lines to the close 7 days ahead with only their numbers (top 10%, average, bottom 10%). It also shows the last card drawn, the cards a Peek revealed, and faint lines for your entry and strikes.
- **Action bar:** before the open it holds the tips, the ticker switch, TRADE and OPEN. During the day it holds TRADE, CLOSE ALL, speed, ⏭ CLOSE and pause. The next sensible button glows.
- **🂠 DECK:** opens the full-screen deck (left in the shoe / in the deck).

## Trading (any time: before the open or during the day. The TRADE menu asks one question at a time, and the day pauses while it is open)
- **LONG STOCK / SHORT STOCK:** the slider sets the share of the room. For a long, the room is buying power = equity × leverage (`LEVERAGE_TIERS`, bought in order). For a short, it's the largest allowed short.
- Each option position is described by what it pays (S = price at expiry, K = strike): long call `pay the premium, get S − K if S > K`, short call `get the premium, pay S − K if S > K`, long put `pay the premium, get K − S if S < K`, short put `get the premium, pay K − S if S < K`.
- **LONG CALL / LONG PUT:** choose K from `CALL_STRIKE_OFFSETS` / `PUT_STRIKE_OFFSETS` (each row shows only K and the premium), then the share of free cash to spend.
- **SHORT CALL / SHORT PUT** (writing): choose K the same way. You receive the premium now and owe the payout at the close. Written options count as exposure like a short of that many shares, and the slider sets the share of that room.
- **Open trades** sit as small icons on their own row (📦 stock on LONG/SHORT STOCK, each option lot on its position's row), outlined green or red by P&L. Clicking one (or its key letter a, b, c …) shows the trade (`x × price = buy-in`, value now, P&L) and offers **ADD** (more of the same: same direction, K and expiry, priced for that expiry) or **CLOSE** (slider: the share of the trade to close). After any trade the menu returns to its first step and the game stays paused until Esc. CLOSE ALL in the action bar closes everything.
- The slider starts at `SLIDER_DEFAULT_PERCENT` and moves in `SLIDER_STEP_PERCENT` steps.
- Margin call: when equity (with written options at their value) < exposure × `MAINTENANCE_SHARE` ÷ leverage, the stock and the short options are closed. A gap (BEAR × σ) can push equity below zero.
- Options expire at the close `OPTION_EXPIRY_DAYS` (7) trading days after they're traded. The side menu shows the days left. The stock is held until you close it. The only costs are transaction costs (`STOCK_TRANSACTION_COST`, `OPTION_TRANSACTION_COST`).

## Insider tips and heat
- Tips are used before the open and read the fixed schedule (`INSIDER_TIPS`): Rumour (▲/▼, the starting tip), Analyst (close inside a 6% band), Peek (first 10 cards on the tape), Vol tip (σ path on the chart), The Call (exact close).
- Each tip adds heat and then rests `cooldownDays`.
- Heat also comes from deck edits (`HEAT_PER_DECK_EDIT`) and from days above `ABNORMAL_RETURN` (`HEAT_PER_ABNORMAL_RETURN`, capped at `HEAT_ABNORMAL_CAP`). It decays by `HEAT_DECAY_PER_DAY`.
- Ending a day at `HEAT_LIMIT` or more opens an investigation: `INVESTIGATION_DAYS` days with no tips, no options and 1× leverage. Afterwards heat resets to `HEAT_AFTER_INVESTIGATION`.

## The run
- You start with `STARTING_CASH`. Trading money and shop money are the same cash.
- Prices inflate by `INFLATION_PER_DAY`: shop prices, stocks (overnight), meeting targets and the minimum cash.
- Every `MEETING_EVERY_DAYS` days there's an investor meeting: equity at the close (open positions at their value) must reach `STARTING_CASH` × inflation × `MEETING_MULTIPLES[n]`, and after the last listed one ×`MEETING_GROWTH_AFTER_LAST` each time. Passing the last listed meeting wins (play on for bigger numbers).
- The run ends at a failed meeting, or when equity after the close is below `MINIMUM_CASH_TO_TRADE` × inflation.

## Shop
- Deck: Remove takes `DECK_BATCH_FIRST` (10) copies of one card the first time, then 9, 8, … down to `DECK_BATCH_MINIMUM`. Add works the same way, with its own count. Each costs `DECK_EDIT_PRICE_GROWTH` more than the last. A deck never goes below `MINIMUM_DECK_SIZE`.
- Event cards: `EVENT_CARD_PRICES`, ×`EVENT_PRICE_GROWTH` per copy.
- Trading: long call, short call, long put and short put, each bought separately (`OPTION_POSITIONS`, with each one's P&L formula), and the next leverage tier (`LEVERAGE_PRICES`). Shorting stock is always possible.
- Insider: the four other tips (`INSIDER_TIPS[].price`).
- Stocks: UTIL (calm) and BIOX (wild) (`TICKER_PRICES`). Pick one before the open.

## Balance notes (tools/sim.cjs bots, 8 runs each, up to day 60, multi-day market)
- Holding cash: dies at the first meeting, every run.
- Coin-flipping 100% long or short for a day: median 10 days.
- Rumour trader (one-day trades on the rumour, leverage + removing bears): median 21 days, best 39 days and $2.6B.
- These bots only day-trade. Holding through the week on the forecast and using weekly options is untested by bots.
