# Insider: design

Every number named here lives in `index.html` § 1 SETTINGS.

## The price is a deck, dealt over many days
- A stock is a deck of cards. NOVA (the starting stock) has 844 cards: `up/down/UP/DOWN` ×100, `bull/bear` ×10, `BULL/BEAR` ×1, and the same counts for the vol cards (`CARD_TYPES`, `TICKERS`).
- Price cards move the price by move × σ. Vol cards multiply σ (`volUP` ×1.05). σ starts each day at 1 and stays between `SIGMA_MINIMUM` and `SIGMA_MAXIMUM`.
- A day is `TICKS_PER_DAY` (90) ticks, one per `SECONDS_PER_TICK` (0.25 s: about 22 seconds a day at 1×). The cards are dealt from a **draw pile**: the shuffled deck, which lasts several days (NOVA: about 9). Only when it runs out is the whole deck reshuffled. A BULL drawn this week is gone until the next shuffle, so the cards left in the draw pile (the 🂠 DECK window) are long-term information.
- Positions are held overnight. Each day opens at yesterday's close × (1 + `INFLATION_PER_DAY`).
- Each stock joins the run with `HISTORY_DAYS` of history already dealt, so day 1 opens at `BASE_OPEN_PRICE` with a week behind it. Every owned stock trades every day, even the ones you're not trading.
- The deck is symmetric, so the average move per card is zero. Moves multiply, though, and +5% then −5% is −0.25%. The more σ there is, the more the price drifts down (volatility drag), against the 1% overnight inflation.
- Today is fixed at the open (`scheduleDay`), seeded by run, day and stock, so a reload gives the same cards.
- Deck edits in the shop change the draw pile at once: removed copies come out of it, added copies are shuffled in.

## News cards (market events, planted in the shop)
News cards change the cards around them; combining them is the deckbuilding. All numbers are in § 1.3.
| Card | Effect | Logic |
|---|---|---|
| 📈 Earnings beat / 📉 Earnings miss (major) | price ±30% × σ, σ ×1.5 | a surprise moves the price and shakes it |
| 🤝 Takeover bid (major) | +25% × σ, then σ ×0.5 | the bid pins the price |
| 🙋 Retail frenzy (major) | 10 ticks of two cards each | a crowd floods in |
| 🥶 Thin market | the next 5 price moves ×2 | few traders, big jumps |
| 🩳 Short squeeze | the next 5 price moves go up | shorts forced to buy |
| 🔥 Fire sale | the next 5 price moves go down | longs forced to sell |
| 🤖 Trend followers | the last price move again | algorithms chase the trend |
| 💼 Profit taking | halfway back to the open | traders cash in |
| 📰 Breaking news | the next 3 cards in one second | |
| 🏛 Fed speech | σ ×2 for 15 ticks | |
| 🏦 Central bank calm | σ back to 1, the Fed stops | |
| 💵 Dividend | 2% of the price per share: longs receive, shorts pay | |
| 🕵️ Leaked memo | shows the next 3 cards | |
| ⏸ Trading halt | price frozen 3 seconds | |
Combinations: a thin market before a BULL, a short squeeze in a bear-heavy deck, breaking news during a Fed speech, trend followers after an earnings beat, profit taking to cut a fall short.

## Rigging the deck: by chance
- After every close your **network** offers `CARD_OFFER_SIZE` (3) random cards: plant one for free (or none).
- **Plant a story** (bought, `CARD_PACK_PRICE`): another 3 random cards, plant one.
- **Bury a story** (bought, `REMOVE_PRICE`): 3 cards drawn at random from the deck, weighted by their copies (a single BEAR is almost never offered); bury `DECK_BATCH_FIRST` (10), then 9, 8 … copies of one.
- Offers are weighted by rarity (`CARD_RARITIES`: minor 6, notable 3, major 1) and plant minor ×10, notable ×8, major ×4 copies.
- Offers are seeded and saved: reloading never re-rolls them. Every deck change adds `HEAT_PER_DECK_EDIT` heat.

## Fair market maker
The market maker knows the cards left in the draw pile and what the whole deck holds, but not the order. Every `FORECAST_EVERY_TICKS` ticks it plays out the rest of today plus `FORECAST_DAYS_AHEAD` (7) more days `FORECAST_PATHS` times (`simulateForecast`, using the same `tickMarket` as the real day). That gives:
- the chart's three numbers: the bottom 10%, the average and the top 10% of the close 7 days ahead. Nothing is shown for today's close: the insider tips are the only edge on today.
- option prices: the higher of exercising now and the average payoff at the expiry day's close; bought at +`OPTION_TRANSACTION_COST` and sold at −`OPTION_TRANSACTION_COST`.

Without information or a rigged deck, nothing has an edge. `node tools/sim.cjs fairness` checks the fair value against real payoffs. An independent check over 1500 runs: a 7-day at-the-money call is priced at 21.6% of the strike and paid 19.0% ± 1.5%.

## Screen (mouse only)
- **Side menu:** the only place with numbers. It shows the day and clock, cash, the stock line `x × average price = buy-in` (negative when short) with its value now, each option lot the same way, equity, heat and the next meeting. "Now" lines are green for a profit and red for a loss, whether long or short.
- **Chart:** the previous week (thin grey), today (live), then three dashed lines to the close 7 days ahead with only their numbers (top 10%, average, bottom 10%). It also shows the last card drawn, the cards a Peek revealed, and faint lines for your entry and strikes.
- **Action bar:** before the open it holds the tips, the ticker switch, TRADE and OPEN. During the day it holds TRADE, CLOSE ALL, speed, ⏭ CLOSE and pause. The next sensible button glows.
- **🂠 DECK:** opens the full-screen deck (left in the draw pile / in the deck).

## Trading (any time: before the open or during the day. The TRADE menu asks one question at a time, and the day pauses while it is open)
- **LONG STOCK / SHORT STOCK:** the slider sets the share of the room. For a long, the room is buying power = equity × leverage (`LEVERAGE_TIERS`, bought in order). For a short, it's the largest allowed short.
- Each position shows its exact P&L per option (S = the price when exercised, K = strike): long call `P&L = max(S − K, 0) − premium`, short call `P&L = premium − max(S − K, 0)`, long put `P&L = max(K − S, 0) − premium`, short put `P&L = premium − max(K − S, 0)`. Stock: `P&L = S − entry price` (long), `entry price − S` (short).
- Options can be exercised at any time up to expiry, so an option is worth the higher of exercising now (`max(S − K, 0)` or `max(K − S, 0)`) and holding to expiry (the forecast's average payoff). A long put is never worth less than K − S.
- **LONG CALL / LONG PUT:** choose K from `CALL_STRIKE_OFFSETS` / `PUT_STRIKE_OFFSETS` (each row shows only K and the premium), then the share of buying power to spend.
- **SHORT CALL / SHORT PUT** (writing): choose K the same way. You receive the premium now and owe the payoff when exercised.
- **Open trades** sit as small icons on their own row (📦 stock on LONG/SHORT STOCK, each option lot on its position's row), outlined green or red by P&L. Clicking one (or its key letter a, b, c …) shows the trade (`x × price = buy-in`, value now, P&L) and offers **ADD** (more of the same: same direction, K and expiry, priced for that expiry) or **CLOSE** (slider: the share of the trade to close). After any trade the menu returns to its first step and the game stays paused until Esc. CLOSE ALL in the action bar closes everything.
- The slider starts at `SLIDER_DEFAULT_PERCENT` (100%) and moves in `SLIDER_STEP_PERCENT` steps.
- **Margin (one rule for everything):** exposure = the stock's value + what long options are worth + short options counted as shares. Buying power = equity × leverage − exposure, and every trade (stock or option, long or short) uses it, so options are bought with leverage too. **Margin call** when equity < exposure × `MAINTENANCE_SHARE` ÷ leverage: everything is closed. The side menu shows "margin call below $X" (red within ×`MARGIN_WARNING`), and every trade shows the margin call level after it. A gap (BEAR × σ) can push equity below zero.
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
