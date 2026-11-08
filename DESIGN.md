# Insider: design

Every number named here lives in `index.html` § 1 SETTINGS.

## The only choices
Which cards to play, when (before the open or during the day), and when to spin the hand. No amounts, no menus, no close buttons. Every trade card has a fixed size and its cost is shown on the card.

## Two decks
**The market deck** (Nova, 844 cards) moves the price: one card per tick, `TICKS_PER_DAY` (90) ticks a day. Moves are ±1/5/10/50% × σ, vol cards multiply σ. It is dealt from a draw pile that lasts several days (🂠 shows what is left).

**Your deck:** every morning you draw `HAND_SIZE` (6). At the close the rest of the hand is discarded. The discard pile is shuffled into a new draw pile when the draw pile is empty.

## A day
1. **Pre-open and the day:** drag cards from the hand up into the play zone (outlined while you drag, with the card's effect written in it). A click picks a card up, the next click places it, right click puts it back. The clock stops while a card is held. 🎰 REDRAW costs money, more each time in one day (`REDRAW_PRICE_STEPS`: $10, $50, $100, $500, $1,000, $5,000 …, back to $10 every morning). It spins the hand like the shop's reels: every card is discarded and a new one drawn in its place, except cards with **RETAIN**: a trade card that would close one of your open trades (a SELL STOCK while you hold stock, a SELL CALL while you hold a call …) stays where it is and does not spin.
2. **`CLOSE_WARNING_TICKS` before the close** (4 s at 1×): a warning sound, a popup and a red badge: every trade still open will be closed.
3. **The close:** dividends are paid, every open trade is closed at the closing price (options at max(S − K, 0) / max(K − S, 0)), heat is added, the meeting is held if it is due. Overnight the stock splits 2:1 above `SPLIT_ABOVE` (1.5) × its normal price (`BASE_OPEN_PRICE` × inflation) and reverse splits below ÷1.5, so 1 stock always costs about $100.
4. **The shop.**

## The cards
| Card | Effect |
|---|---|
| BUY STOCK 1 / 3 / 10 (green) | buy that many stock at the price now. Holding a short: closes your oldest short instead |
| SELL STOCK 1 / 3 / 10 (red) | holding stock: sells your oldest stock trade. Holding none: shorts that many |
| BUY CALL K = S, 3S/4, S/2, S/4 (green) | `OPTION_QUANTITY` (5) calls, P&L = max(S − K, 0) × 5 − the price, expire at the close |
| BUY PUT K = S, 3S/4, S/2, S/4 (red) | 5 puts, P&L = max(K − S, 0) × 5 − the price |
| SELL CALL (red) / SELL PUT (green) | sell your oldest call / put at its value now |
| Leverage (gold, face only): +1 +4 +9, ×2 ×5 ×10, +1 & ^2 ^5 ^10 | the **next trade** gets L + n, L × n, (L + 1)ⁿ, in the order played (badge "next trade ×L") |
| DOUBLE | your newest trade: double risk and reward, same money in it |
| TOP-UP I/II/III | your newest trade: +50/100/200% of its money in again, liquidated later |
| DIVIDENDS I/II/III | at the close long stock and calls get 1/3/8% of their value, a short pays it |
| CEILING / FLOOR I/II/III | for 15/30/60 ticks the price cannot rise above / fall below the price now |
| HYPE I/II/III | +10/25/50% over `HYPE_TICKS` (10) ticks, then back over 10 |
| BASH I/II/III | −10/20/35%, then back |
| TURMOIL / CALM I/II/III | σ ×1.5/2/3, σ ×0.7/0.5/0.25 until the close |

Hovering a card in the hand says exactly what it does now, with today's prices and the leverage waiting: "Buy 2 stock for $100 (2× leverage). P&L = 2 × (S − 100.0). Liquidated at S = 50.0.", "Buy 5 puts, K = 75.0, for $1.87. P&L = max(75.0 − S, 0) × 5 − $1.87.", "Next trade: double risk & reward.", "Closes trade #1 (LONG STOCK): now $112, P&L +$12."

Manipulation, Ceiling and Floor add heat `HEAT_BY_TIER` (10/20/35%). Starting deck (`STARTING_DECK`, 13): 3 BUY STOCK, 3 SELL STOCK, BUY CALL K = S, BUY PUT K = S, SELL CALL, SELL PUT, ×2, Hype I, Bash I.

## Margin (one rule for every trade)
A trade's cost is its money in it. With leverage L it holds L times as much (the rest is borrowed). It is worth the money in it plus quantity × (price now − price paid). When that reaches 0 it is **liquidated**: the money in it is gone, never more. A stock at L dies after a move of 1/L against it (the chart shows each liquidation price). Double and Top-up reset the reference to the value now.

## The market maker
It knows the cards left in the market draw pile and the whole deck, not their order, and every manipulation already played. Every tick it plays out the rest of the day `FORECAST_PATHS` (800) times with the same `tickMarket` as the real day. An option is worth the higher of exercising now and the average payoff at the close, never sold below `MINIMUM_OPTION_PRICE` × S. It only sees a manipulation once it is played, so **the order of your cards is the edge**: buy, then Hype, then sell at the top. `node tools/sim.cjs fairness`: a same-day at-the-money call is priced at 13.4% of S and paid 14.2% (400 days).

## Heat and the SEC
Heat comes from cards and from days above `ABNORMAL_RETURN` (+25%) and decays `HEAT_DECAY_PER_DAY` a day. Ending a day at 100% starts an investigation for `INVESTIGATION_DAYS` (3): no heat cards and no leverage.

## The run
- `STARTING_CASH` 500. Trading money and shop money are the same cash. Prices inflate 1% a day.
- Every `MEETING_EVERY_DAYS` (10) days cash at the close must reach `STARTING_CASH` × inflation × `MEETING_MULTIPLES[n]` (1.1, 1.5, 3, 10, 50 …). The meeting day has a boss rule (`BOSS_RULES`): no new shorts, no new longs, −0.3% every tick, ×2 all day, no options, leverage ≤ 5×, moves capped at 5%. The next meeting is shown in the menu, on the result screen and in the shop.
- The run ends at a failed meeting, or when cash after the close is below `BROKE_SHARE` (¼) of a stock.

## The shop: four reels
After every close: LONG (green cards, Dividends, Floor), SHORT (red cards, Ceiling), MANIP, LEVERAGE (leverage, Double, Top-up). Each reel shows one card. BUY shuffles it into your draw pile. 🎰 SPIN rerolls all four, `SPIN_PRICE` (5) and 5 more per spin in one visit. Tiers I/II/III land 70/25/5% and cost 40/100/250. SELL A CARD sells for half (never below 8 cards). The shop never spends the cash for `SHOP_RESERVE_STOCKS` (2) stock at the next open. All prices × inflation.

## Screen
The chart fills the screen: the past week (thin) and today (live), liquidation lines, strikes, ceiling and floor bars. Top left: the last market card and what is in force (next trade ×L, the close warning, σ, pushes still to come, ceiling, floor, dividends, the meeting rule). Top right: cash, today's P&L, heat %, 🂠 deck, ☰ menu. Below: the hand, then 🎰 REDRAW, OPEN / speed, skip to the close, pause. Mouse only, buttons fire on the press.

## Balance notes (`node tools/sim.cjs bots`, 30 runs, first meeting $601)
- Holding cash: fails the first meeting. Coin-flipping a stock card a day: median peak $622, fails the first meeting (best run 30 days).
- Hype bot (leverage up to 4×, BUY STOCK, Hype, sells at the top if it holds a SELL card, one combo a day, shops only when ahead): median peak $600, best 20 days. A player plays more than one combo a day, uses calls before Hype and Floor under leverage.
