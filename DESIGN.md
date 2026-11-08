# Insider: design

Every number named here lives in `index.html` § 1 SETTINGS.

## Two decks
**The market deck** (Nova, 844 cards) moves the price: one card per tick, `TICKS_PER_DAY` (90) ticks a day. Moves are ±1/5/10/50% × σ, vol cards multiply σ. It is dealt from a draw pile that lasts several days, so the deck window (🂠 DECK) is long-term information.

**Your deck** holds trade, leverage, special and manipulation cards. Every morning you draw `HAND_SIZE` (6). At the close the rest of the hand is discarded. The discard pile is shuffled into a new draw pile when the draw pile is empty.

## A day
1. **Morning (pre-open):** play cards, build trades, `REDRAWS_PER_DAY` (2) redraws. A redraw spins the hand like the shop's reels: the hand is discarded, as many cards are drawn, and each slot runs past cards of your deck and stops on its new card, left to right.
2. **The day:** the same, while the price runs. The clock stops while a trade is on the bench, a card is held, or the hand spins.

**Playing a card (like Slay the Spire):** drag it from the hand up into the play zone (everything above the hand, outlined while you drag, with a label saying what letting go will do). A click without dragging picks the card up and it follows the mouse until the next click plays it there (right click puts it back). Double and Top-up are dropped on an open trade (with one trade open, anywhere works).
3. **The close:** dividends are paid, every trade is closed at the closing price (options at max(S − K, 0) / max(K − S, 0)), heat is added, the meeting is held if it is due.
4. **The shop.**

At most `TRADES_PER_DAY` (3) trade cards a day. Other cards have no daily limit, only heat.

## Building a trade: the bench
Play a trade card: it goes to the bench. Play leverage cards: they line up behind it and apply **left to right**. Click a bench card to send it back. The bench shows the chain (`1 → +1 = 2 → ×2 = 4`), the stake slider (share of cash, starting at cash ÷ trades left), the position, the option price, and the liquidation price (also on the chart). OPEN TRADE costs `TRADE_FEE` (1%) of the stake on top.

## The cards
| Family | Cards | Effect |
|---|---|---|
| Long (green, a rising price line) | stock, call K = S, 3S/4, S/2, S/4 | stock P&L = S − entry; a call pays max(S − K, 0) at the close |
| Short (red, a falling price line) | stock, put K = S, 3S/4, S/2, S/4 | stock P&L = entry − S; a put pays max(K − S, 0) |
| Leverage (gold) | +1 +4 +9, ×2 ×5 ×10, +1 & ^2 ^5 ^10 | L + n, L × n, (L + 1)ⁿ |
| Special (blue) | Double | on an open trade: the position doubles, the money in it stays |
| | Top-up I/II/III | on an open trade: +50/100/200% of its stake from cash as extra margin |
| | Dividends I/II/III | at the close long stock and calls get 1/3/8% of their position, short stock pays it |
| | Ceiling / Floor I/II/III | for 15/30/60 ticks the price cannot rise above / fall below the price now |
| Manipulation (orange) | Hype I/II/III | +10/25/50% over `HYPE_TICKS` (10) ticks, then back over 10 |
| | Bash I/II/III | −10/20/35%, then back |
| | Turmoil / Calm I/II/III | σ ×1.5/2/3, σ ×0.7/0.5/0.25 until the close |

Manipulation, Ceiling and Floor add heat `HEAT_BY_TIER` (10/20/35). Options expire at today's close.

Starting deck (`STARTING_DECK`, 12): 3 long stock, 3 short stock, call K = S, put K = S, +1, ×2, Hype I, Bash I.

## Margin (one rule for every trade)
You put in a stake s and borrow (L − 1) × s. A trade is worth margin + side × quantity × (unit price now − reference price). When that reaches 0 it is **liquidated**: the money in it is gone, never more (the broker takes a gap). A long stock at L dies after a fall of 1/L (50× at −2%, 1024× at −0.1%). A leveraged option dies when it has lost 1/L of its price. Double and Top-up reset the reference: margin = the trade's value then.

## The market maker
It knows the cards left in the market draw pile and the whole deck, not their order, and every manipulation already played (they live in the market state). Every tick it plays out the rest of the day `FORECAST_PATHS` (800) times with the same `tickMarket` as the real day. An option is worth the higher of exercising now and the average payoff at the close, and is never sold below `MINIMUM_OPTION_PRICE` × S. Because it only sees a manipulation once it is played, **the order of your cards is the edge**: buy calls, then play Hype. `node tools/sim.cjs fairness`: a same-day at-the-money call is priced at 13.6% of S and paid 12.7% (400 days).

## Combos the cards are built for
- **Floor + Power:** a huge long is close to safe while the floor holds.
- **Calls before Hype, puts before Bash:** cheap before, worth a lot during.
- **Turmoil before options, Calm before high leverage.**
- **Leverage order:** add, then multiply, then power.
- **Hype, then Double near the top, then close.**

## Heat and the SEC
Heat comes from cards and from days above `ABNORMAL_RETURN` (+25%). It decays `HEAT_DECAY_PER_DAY` a day. Ending a day at `HEAT_LIMIT` (100) starts an investigation for `INVESTIGATION_DAYS` (3): no heat cards and no leverage.

## The run
- `STARTING_CASH` 1000. Trading money and shop money are the same cash. Prices inflate `INFLATION_PER_DAY` (1%).
- Every `MEETING_EVERY_DAYS` (10) days equity at the close must reach `STARTING_CASH` × inflation × `MEETING_MULTIPLES[n]`. The meeting day has a boss rule (`BOSS_RULES`), shown in the side menu from the start: no shorts, no longs, −0.3% every tick, ×2 all day, no options, 1 trade, leverage ≤ 5×, moves capped at 5%.
- The run ends at a failed meeting or when cash after the close is below `MINIMUM_CASH_TO_TRADE` × inflation.

## The shop: four reels
After every close: LONG (long cards, Dividends, Floor), SHORT (short cards, Ceiling), MANIP, LEVERAGE (leverage cards, Double, Top-up). Each reel shows one card. BUY adds it to your draw pile. SPIN rerolls all four like a slot machine, `SPIN_PRICE` (5) and `SPIN_PRICE_STEP` (5) more per spin in one visit. A reel lands on tier I/II/III with `TIER_ODDS` (70/25/5%). Prices `TIER_PRICES` (40/100/250). SELL A CARD sells for `SELL_SHARE` (half), never below `MINIMUM_PLAYER_DECK` (8) cards. All prices × inflation.

## Screen (mouse only, actions fire on the press)
Side menu: day, clock, price, cash, money in trades, equity and today's P&L, heat, the next meeting and its rule. Chart: the previous days and today, liquidation lines, strikes, the bench's preview, ceiling and floor bars. The corner shows the last market card, σ, pushes still to come, ceiling, floor, dividends, the boss rule. Table: open trades (value, P&L, leverage now, liquidation price, CLOSE) and the bench. Hand, with trades and redraws left. Buttons: 🎰 REDRAW, OPEN / CLOSE ALL, speed, skip to the close, pause.

## Balance notes (`node tools/sim.cjs bots`, 30 runs)
- Holding cash and coin-flipping stock trades: fail the first meeting (median).
- A Hype/Bash bot (stock + every leverage card, closed at the top, buys leverage and manipulation): median fails the first meeting, best run 60 days and $1.1e16. It never uses calls, Floor or timing, so a player has a lot more room.
