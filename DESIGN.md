# Insider: design

Every number named here lives in `index.html` § 1 SETTINGS.

## Two decks
You build two decks. **The market** (one deck per market you trade) decides what the price does; you change it by chance in the shop. **Your playbook** decides what you can do to the market each day; you learn and forget plays in the shop.

## The markets (§ 1.4)
| Market | Type | σ at the open | Its own cards |
|---|---|---|---|
| 💻 Nova (start) | stock | 1 | dividend, ×3 (results day) |
| 🛒 Mart | stock | 0.8 | dividends in the deck |
| 🥇 Gold | commodity | 1.4 | ±20% jumps, −0.3% all day (storage), ½ back; reverses in the deck |
| 🛢 Oil | commodity | 1.8 | ±20% jumps, storage, doubles in the deck |
| 🌍 World | ETF | 0.5 | +0.3% all day (growth), ½ back |
Every market also holds the common cards: moves ±1/5/10/50% × σ, vol cards (σ ±1/5/10/50%), repeat, reverse, ×2 / ½ next, and the rule cards (+1% / −1% all day, ×2 / ½ all day, no buying, no selling, draw 3). "Add a card" only offers cards that market's type can hold.
A deck is dealt from a draw pile over several days; drawn cards stay gone until the reshuffle, so the deck window is long-term information. Positions are held overnight; each day opens at yesterday's close + 1% inflation.

## Cards that act on cards
repeat (the last move again, as it happened), reverse (the other way), ×2 / ½ / ×3 next (stack until a move uses them), ½ back (halfway to the open), and the rule cards that hold until the close. The chart's corner shows what is waiting or in force.

## The playbook (§ 1.8, § 6)
Every morning `HAND_SIZE` (5) plays are dealt from your playbook; you have `FOCUS_PER_DAY` (3) focus. Plays can be used before the open and during the day; some add heat.
| Play | Focus | Heat | Effect |
|---|---|---|---|
| Peek 3 | 1 | 5 | see the next 3 market cards |
| Rumour | 1 | 10 | will today close above or below the price now? |
| Insider call | 2 | 40 | the exact close, as the cards lie now |
| Pick 1 of 2 | 1 | 5 | see the next 2 cards, choose which comes next |
| Skip | 1 | 0 | the next card goes to the bottom, unplayed |
| Flip | 2 | 10 | the next move goes the other way |
| Freeze | 1 | 0 | no market cards for 5 ticks |
| Push up / Push down | 1 | 8 | move the price ±2% now |
| Stack ×2 / Dampen ½ | 1 | 0 | the next move ×2 / ×½ |
| Double down | 1 | 0 | double your stock position |
| Turn around | 0 | 0 | close the stock and open the same size the other way |
| Hedge | 1 | 0 | the next move against your stock costs half |
| Trailing stop | 1 | 0 | close the stock when the price turns 5% from its best |
| Pyramid | 2 | 0 | every move in your favour adds 10% to the stock |
A play that changes the market rebuilds the rest of the day from the cards left (`changeMarket`), so later information (Rumour, Insider call) reads the new future. Synergies: Pick 1 of 2 + Stack ×2 on a BULL; Flip on the bear you see coming; Freeze after a spike; Pyramid in a repeat-heavy deck; Hedge + Push down for a cheap short entry.

## Boss days (meetings)
Every `MEETING_EVERY_DAYS` days the investors meet, and that day has a boss rule (`BOSS_RULES`), shown in the side menu from the start: no selling all day, no buying all day, −1% all day, ×2 all day, no options, 1 focus, or moves capped at 5%. Equity at that close must reach the target.

## Fair market maker
The market maker knows the cards left in the draw pile and what the whole deck holds, but not the order. Every `FORECAST_EVERY_TICKS` ticks it plays out the rest of today plus `FORECAST_DAYS_AHEAD` (7) more days `FORECAST_PATHS` times (`simulateForecast`, using the same `tickMarket` as the real day). That gives:
- the chart's three numbers (only once the 🔮 Forecast is bought, `FORECAST_PRICE`): the bottom 10%, the average and the top 10% of the close 7 days ahead. Nothing is shown for today's close: plays (Rumour, Insider call, Peek, Pick 1 of 2) are the edge on today.
- option prices: the higher of exercising now and the average payoff at the expiry day's close; bought at +`OPTION_TRANSACTION_COST` and sold at −`OPTION_TRANSACTION_COST`.

Without information or a rigged deck, nothing has an edge. `node tools/sim.cjs fairness` checks the fair value against real payoffs. An independent check over 1500 runs: a 7-day at-the-money call is priced at 21.6% of the strike and paid 19.0% ± 1.5%.

## Screen (mouse only)
- **Side menu:** the only place with numbers. It shows the day and clock, cash, the stock line `x × average price = buy-in` (negative when short) with its value now, each option lot the same way, equity, heat and the next meeting. "Now" lines are green for a profit and red for a loss, whether long or short.
- **Chart:** the previous week (thin grey), today (live), and once the Forecast is bought three dashed lines to the close 7 days ahead with only their numbers. The corner shows the last card, a waiting multiplier, and peeked cards. It also shows the last card drawn, the cards a Peek revealed, and faint lines for your entry and strikes.
- **Hand:** the plays dealt today, with focus left; click one to play it. **Action bar:** before the open it holds the market switch, TRADE and OPEN. During the day it holds TRADE, CLOSE ALL, speed, ⏭ CLOSE and pause. The next sensible button glows.
- **🂠 DECK:** opens the full-screen deck (left in the draw pile / in the deck).

## Trading (any time: before the open or during the day. The TRADE menu asks one question at a time, and the day pauses while it is open)
- **LONG STOCK / SHORT STOCK:** the slider sets the share of the room. For a long, the room is buying power = equity × leverage (`LEVERAGE_TIERS`, bought in order). For a short, it's the largest allowed short.
- Each position shows its exact P&L per option (S = the price when exercised, K = strike): long call `P&L = max(S − K, 0) − premium`, short call `P&L = premium − max(S − K, 0)`, long put `P&L = max(K − S, 0) − premium`, short put `P&L = premium − max(K − S, 0)`. Stock: `P&L = S − entry price` (long), `entry price − S` (short).
- Options can be exercised at any time up to expiry, so an option is worth the higher of exercising now (`max(S − K, 0)` or `max(K − S, 0)`) and holding to expiry (the forecast's average payoff). A long put is never worth less than K − S.
- **LONG CALL / LONG PUT:** choose K from `CALL_STRIKE_OFFSETS` / `PUT_STRIKE_OFFSETS` (each row shows only K and the premium), then the share of buying power to spend.
- **SHORT CALL / SHORT PUT** (writing): choose K the same way. You receive the premium now and owe the payoff when exercised.
- **Open trades** sit as small icons on their own row (📦 stock on LONG/SHORT STOCK, each option lot on its position's row), outlined green or red by P&L. Clicking one (or its key letter a, b, c …) shows the trade (`x × price = buy-in`, value now, P&L) and offers **ADD** (more of the same: same direction, K and expiry, priced for that expiry) or **CLOSE** (slider: the share of the trade to close). After any trade the menu returns to its first step and the game stays paused until Esc. CLOSE ALL in the action bar closes everything.
- The slider starts at `SLIDER_DEFAULT_PERCENT` (100%) and moves in `SLIDER_STEP_PERCENT` steps.
- **Margin (one rule for everything):** exposure = the stock's value + what long options are worth + short options counted as shares. Buying power = equity × leverage − exposure, and every trade (stock or option, long or short) uses it, so options are bought with leverage too. **Margin call** when equity < exposure × `MAINTENANCE_SHARE` ÷ leverage: everything is closed. The side menu shows "margin call below $X" (red within ×`MARGIN_WARNING`), and every trade shows the margin call level after it. A big move (a doubled BEAR × σ) can push equity below zero.
- Options expire at the close `OPTION_EXPIRY_DAYS` (7) trading days after they're traded. The side menu shows the days left. The stock is held until you close it. The only costs are transaction costs (`STOCK_TRANSACTION_COST`, `OPTION_TRANSACTION_COST`).

## Heat and the SEC
Heat comes from plays (their 🔥), from deck changes (`HEAT_PER_DECK_EDIT`) and from days above `ABNORMAL_RETURN`; it decays by `HEAT_DECAY_PER_DAY`. Ending a day at `HEAT_LIMIT` opens an investigation for `INVESTIGATION_DAYS` days: no plays that add heat, no options, new trades at 1×.

## The run
- You start with `STARTING_CASH`. Trading money and shop money are the same cash.
- Prices inflate by `INFLATION_PER_DAY`: shop prices, stocks (overnight), meeting targets and the minimum cash.
- Every `MEETING_EVERY_DAYS` days there's an investor meeting: equity at the close (open positions at their value) must reach `STARTING_CASH` × inflation × `MEETING_MULTIPLES[n]`, and after the last listed one ×`MEETING_GROWTH_AFTER_LAST` each time. Passing the last listed meeting wins (play on for bigger numbers).
- The run ends at a failed meeting, or when equity after the close is below `MINIMUM_CASH_TO_TRADE` × inflation.

## Shop
- Deck: Remove takes `DECK_BATCH_FIRST` (10) copies of one card the first time, then 9, 8, … down to `DECK_BATCH_MINIMUM`. Add works the same way, with its own count. Each costs `DECK_EDIT_PRICE_GROWTH` more than the last. A deck never goes below `MINIMUM_DECK_SIZE`.
- Event cards: `EVENT_CARD_PRICES`, ×`EVENT_PRICE_GROWTH` per copy.
- Trading: long call, short call, long put and short put, each bought separately (`OPTION_POSITIONS`, with each one's P&L formula), and the next leverage tier (`LEVERAGE_PRICES`). Shorting stock is always possible.
- Plays: Learn a play (pick 1 of 3), Forget a play (pick any), and the Forecast.
- Markets: Mart, Gold, Oil, World (`TICKERS[].price`). Pick one before the open, while you hold nothing.

## Balance notes (tools/sim.cjs bots, 8 runs each, up to day 60, multi-day market)
- Holding cash: dies at the first meeting, every run.
- Coin-flipping 100% long or short for a day: median 10 days.
- Rumour trader (one-day trades on the rumour, leverage + removing bears): median 21 days, best 39 days and $2.6B.
- These bots only day-trade. Holding through the week on the forecast and using weekly options is untested by bots.
