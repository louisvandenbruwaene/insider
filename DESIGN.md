# Insider: design

Every number named here lives in `index.html` § 1 SETTINGS.

## The price is a deck
- A stock is a deck of cards. NOVA (the starting stock) has 844 cards: `up/down/UP/DOWN` ×100, `bull/bear` ×10, `BULL/BEAR` ×1, and the same counts for the vol cards (`CARD_TYPES`, `TICKERS`).
- Price cards move the price by move × σ. Vol cards multiply σ (`volUP` ×1.05). σ starts each day at 1 and stays between `SIGMA_MINIMUM` and `SIGMA_MAXIMUM`.
- A day is `TICKS_PER_DAY` (90) ticks, one per `SECONDS_PER_TICK`. Each tick draws one card from the shuffled deck, so a day uses about 90 of the 844 cards and the close is uncertain.
- The deck is symmetric, so the average move per card is zero. Moves multiply, though, and +5% then −5% is −0.25%. The more σ there is, the more the price drifts down (volatility drag). That's why most days close lower.
- The whole day is fixed at the open (`scheduleDay`). The day's shuffle is seeded by run, day and ticker, so a reload gives the same cards.

## Event cards (bought in the shop, one copy at a time)
`earnings` (the next `EARNINGS_EXTRA_CARDS` cards land in the same second), `fed` (σ ×`FED_SIGMA_MULTIPLIER` for `FED_TICKS`), `halt` (price frozen `HALT_SECONDS`, trading still allowed), `momentum` (repeats the last price move), `squeeze` (+`SQUEEZE_MOVE` × σ).

## Fair market maker
The market maker knows which cards are left but not their order. Every tick it plays out the rest of the day `FORECAST_PATHS` times (`simulateCloses`). That gives:
- the chart's three numbers: the bottom 10%, the average and the top 10% close (`FORECAST_LOW_QUANTILE`, `FORECAST_HIGH_QUANTILE`),
- option prices: fair value = the average payoff, bought at +`OPTION_TRANSACTION_COST` and sold at −`OPTION_TRANSACTION_COST`,
- the 🎲 chance and the "×" win multiple in the strike list.

Without information or a rigged deck, nothing has an edge. `node tools/sim.cjs fairness` checks the fair value against real average payoffs, and `node tools/sim.cjs equivalence` checks that the fast simulator matches the real day exactly.

## Screen
- **Side menu:** the only place with numbers. It shows the day and clock, cash, the stock line `x × average price = buy-in` (negative when short) with its value now, each option lot the same way, equity, heat and the next meeting. "Now" lines are green for a profit and red for a loss, whether long or short.
- **Chart:** today's path, then three dashed lines to the close with only their numbers (top 10%, average, bottom 10%). It also shows the last card drawn, the cards a Peek revealed, and faint lines for your entry and strikes.
- **Action bar:** before the open it holds the tips, the ticker switch, TRADE and OPEN. During the day it holds TRADE, CLOSE ALL, speed, ⏭ CLOSE and pause. The next sensible button glows.
- **🂠 DECK:** opens the full-screen deck (left today / in the deck).

## Trading (the TRADE menu asks one question at a time, and the day pauses while it is open)
- **LONG / SHORT:** the slider sets the share of the room. For a long, the room is buying power = equity × leverage (`LEVERAGE_TIERS`, bought in order). For a short, it's the largest allowed short. Before shorting is unlocked, SHORT is SELL (your own shares only).
- **BUY OPTION:** call or put, then a strike from `CALL_STRIKE_OFFSETS` / `PUT_STRIKE_OFFSETS` (each row shows its 🎲 chance, win multiple and price), then the share of free cash to spend.
- **SELL OPTION** (writing): same steps. You receive the premium now and owe the payout at the close. Written options count as exposure like a short of that many shares, and the slider sets the share of that room.
- **CLOSE:** the stock, one lot, or everything.
- The slider starts at `SLIDER_DEFAULT_PERCENT` and moves in `SLIDER_STEP_PERCENT` steps.
- Margin call: when equity (with written options at their value) < exposure × `MAINTENANCE_SHARE` ÷ leverage, the stock is closed and written options are bought back. A gap (BEAR × σ) can push equity below zero.
- Options expire at the close and everything settles there: you never hold overnight. The only costs are transaction costs (`STOCK_TRANSACTION_COST`, `OPTION_TRANSACTION_COST`).

## Insider tips and heat
- Tips are used before the open and read the fixed schedule (`INSIDER_TIPS`): Rumour (▲/▼, the starting tip), Analyst (close inside a 6% band), Peek (first 10 cards on the tape), Vol tip (σ path on the chart), The Call (exact close).
- Each tip adds heat and then rests `cooldownDays`.
- Heat also comes from deck edits (`HEAT_PER_DECK_EDIT`) and from days above `ABNORMAL_RETURN` (`HEAT_PER_ABNORMAL_RETURN`, capped at `HEAT_ABNORMAL_CAP`). It decays by `HEAT_DECAY_PER_DAY`.
- Ending a day at `HEAT_LIMIT` or more opens an investigation: `INVESTIGATION_DAYS` days with no tips, no options and 1× leverage. Afterwards heat resets to `HEAT_AFTER_INVESTIGATION`.

## The run
- You start with `STARTING_CASH`. Trading money and shop money are the same cash.
- Prices inflate by `INFLATION_PER_DAY`: shop prices, the opening price (`BASE_OPEN_PRICE`), meeting targets and the minimum cash.
- Every `MEETING_EVERY_DAYS` days there's an investor meeting: equity at the close must reach `STARTING_CASH` × inflation × `MEETING_MULTIPLES[n]`, and after the last listed one ×`MEETING_GROWTH_AFTER_LAST` each time. Passing the last listed meeting wins (play on for bigger numbers).
- The run ends at a failed meeting, or when cash after the close is below `MINIMUM_CASH_TO_TRADE` × inflation.

## Shop
- Deck: Remove takes `DECK_BATCH_FIRST` (10) copies of one card the first time, then 9, 8, … down to `DECK_BATCH_MINIMUM`. Add works the same way, with its own count. Each costs `DECK_EDIT_PRICE_GROWTH` more than the last. A deck never goes below `MINIMUM_DECK_SIZE`.
- Event cards: `EVENT_CARD_PRICES`, ×`EVENT_PRICE_GROWTH` per copy.
- Trading: shorting, calls, puts (`UNLOCK_PRICES`), the next leverage tier (`LEVERAGE_PRICES`).
- Insider: the four other tips (`INSIDER_TIPS[].price`).
- Stocks: UTIL (calm) and BIOX (wild) (`TICKER_PRICES`). Pick one before the open.

## Balance notes (tools/sim.cjs bots, 16 runs each, up to day 120)
- Holding cash: dies at the first meeting, every run.
- Coin-flipping 100% long or short: median 10 days.
- Rumour trader (short + leverage + removing bears): median 20 days, best run 51 days and $110M.
- These bots are crude. A player who rigs the deck and uses options well should do much better.
