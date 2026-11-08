# Insider: the trade-card redesign (proposal)

Status: design only, nothing built yet. Louis's ask of 2026-11-08, with my choices marked **(mine)**. Card faces and the shop reels are drawn in `design/cards-mockup.html`.

## The idea in one paragraph
The market deck still moves the price, and the fair market maker still prices it from that deck. You now hold a second deck: **your trade cards**. A trade is a trade card with leverage cards stacked on it in order. Manipulation and special cards bend the market or your open trades. The market maker only learns about a manipulation once it is played, so the edge is the order you play cards in: buy the calls, *then* play Hype. Every position is closed at the close, so each day is one self-contained round.

## A day
1. **Morning:** draw up to `HAND_SIZE` (6). You get `REDRAWS_PER_DAY` (2) redraws: pick any cards from the hand, they go to the discard pile, and you draw as many.
2. **Before the open and during the day** (the day pauses while you build a trade): play cards. At most `TRADES_PER_DAY` (3) trade cards a day. Leverage, special and manipulation cards have no daily limit, only heat.
3. **The close:** every open trade is closed at the closing price (options at `max(S − K, 0)` / `max(K − S, 0)`), losses too. Dividends are paid. Played cards go to the discard pile, unplayed ones stay in the hand.
4. **The shop** opens after every close (see below). Meetings and boss days stay as they are.

The player deck reshuffles when its draw pile is empty, like the market deck.

## Building a trade: the bench
Click a trade card and it moves to the **bench**. Click leverage cards and they line up to its right, applied **left to right**. Click a bench card to send it back to the hand. The bench shows, live:
- the leverage chain, for example `1 → +4 = 5 → ×10 = 50`
- the stake slider (it starts at free cash ÷ trades left today) **(mine)**
- the position size, the premium for an option, and the **liquidation price**, also drawn on the chart as a red dashed line

OPEN makes the trade. The order matters: `+4` then `×10` is 50×, `×10` then `+4` is 14×.

## Card families
### Long (green, a ragged lightning arrow up)
| Card | What it is |
|---|---|
| Long stock | P&L = S − entry price, per share |
| Call K = S | pay the premium, get max(S − K, 0) at the close |
| Call K = 3S/4, S/2, S/4 | the same with the strike set by the game below the price now. Deeper is more expensive and behaves more like stock, but still cannot lose more than the premium |

### Short (red, a ragged lightning arrow down)
| Card | What it is |
|---|---|
| Short stock | P&L = entry price − S, per share |
| Put K = S | pay the premium, get max(K − S, 0) at the close |
| Put K = 3S/4, S/2, S/4 | the strike below the price now: cheap crash tickets that pay only on a big fall |

All options are bought from the market maker at fair value + `OPTION_TRANSACTION_COST` and expire at today's close.

### Leverage (gold; three tiers by family)
A trade starts at leverage L = 1, and each card changes L in turn:
| Family | Cards | Rule |
|---|---|---|
| Add | +1, +4, +9 | L ← L + n |
| Multiply | ×2, ×5, ×10 | L ← L × n |
| Power | +1 & ^2, +1 & ^5, +1 & ^10 | L ← (L + 1)ⁿ |

A power card alone on a stock gives 2² = 4×, 2⁵ = 32×, 2¹⁰ = 1024×. After `×10` it gives 11² = 121×.

### Margin (one rule for every trade, as in real life)
You post the stake s and borrow (L − 1) × s. The trade is worth its position value minus what was borrowed. **When that reaches 0, the trade is closed and the stake is gone.** So a long at L dies after a fall of about 1/L: 50× dies at −2%, 1024× at −0.1%. A jump straight past the liquidation price still costs only the stake (the broker takes the gap) **(mine)**. An option at L dies when the option has lost 1/L of its price.

### Special (blue)
| Card | Tiers | Effect |
|---|---|---|
| Double | one | play on an open trade: its leverage doubles with the same stake, so its liquidation price moves twice as close |
| Dividends | 1% / 3% / 8% | at today's close every long stock and call is paid that share of its exposure (leverage counts). Shorts pay it, as in real life |
| Ceiling | 15 / 30 / 60 ticks | the price cannot rise above the price now for that long, drawn as a line on the chart |
| Floor | 15 / 30 / 60 ticks | the price cannot fall below the price now for that long |
| Top-up **(mine)** | +50% / +100% / +200% | play on an open trade: add that share of its stake from cash as extra margin, so its liquidation price moves further away |

### Manipulation (orange; every one adds heat)
| Card | Tiers | Effect |
|---|---|---|
| Hype | +5% / +12% / +30% | the price climbs that much over the next 10 ticks, then falls back over the 10 after |
| Bash | −5% / −12% / −30% | the reverse: down, then back up |
| Turmoil | σ ×1.5 / ×2 / ×3 | until the close |
| Calm | σ ×0.7 / ×0.5 / ×0.25 | until the close |
Heat: tier I 10, II 20, III 35. Ceiling and Floor are manipulation too and add the same heat **(mine)**. The SEC rules stay as they are.

## The combos this is built for
- **Floor + Power:** 1024× long is suicide on its own and close to safe under a Floor. The Floor runs out, so close in time.
- **Calls before Hype:** buy cheap calls, then play Hype, close at the top before the fall back.
- **Turmoil before options, Calm before high leverage:** Turmoil makes your options worth more once priced in, Calm stretches how long a big leverage survives.
- **Order of leverage cards:** add first, multiply second, power last. The best order is the puzzle in every trade.
- **Hype, then Double at the top, then short:** Hype has to come back down.

## The shop: four reels
After every close the shop shows four reels side by side, like a slot machine, each with one card and its price:
| Reel | Can show |
|---|---|
| LONG | long stock, calls (every strike), Dividends, Floor |
| SHORT | short stock, puts (every strike), Ceiling |
| MANIP | Hype, Bash, Turmoil, Calm |
| LEVERAGE | add, multiply and power cards, Double, Top-up |
- **BUY** under each reel adds that card to your deck. A bought reel shows SOLD until the next spin.
- **SPIN** rerolls all four reels at once: they spin and stop left to right, each with a click. The first spin of a visit costs `SPIN_PRICE` ($5), every next one $5 more **(mine)**.
- Tier odds: I 70%, II 25%, III 5% **(mine)**. Prices: I $40, II $100, III $250. All prices inflate 1% a day.

## A starting deck (13 cards) **(mine)**
3 long stock, 3 short stock, 1 call K = S, 1 put K = S, 2 × +1, 1 × ×2, 1 Hype I, 1 Bash I.

## What goes away
The playbook and focus (peek, rumour, insider call and the rest), holding overnight and weekly options, the TRADE menu (replaced by the bench), leverage tiers and option unlocks bought in the shop (now cards), market deck editing in the shop, and the bought forecast.

## What stays
The market deck and its cards (moves, vol, rule cards), the fair market maker, transaction costs, heat and the SEC, meetings and boss days, inflation, the side menu with every number, mouse only.

## Open questions for Louis
1. Do the other four markets (Mart, Gold, Oil, World) stay, and how are they unlocked now the shop has only four reels?
2. Can you sell or remove a card from your deck? (A deckbuilder usually needs thinning. My suggestion: sell any card for half its price in the shop.)
3. Is "Double" meant for an open trade (my reading) or as a leverage card stacked on the bench before the trade opens?
