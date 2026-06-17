# Signal → Revenue Retro (mechanism proof)

The one analysis that turns Revint from a good narrative into a defensible company.

Everything on the marketing site proves the **problem** (sales teams forget, win-loss is rare, knowledge walks out at turnover). None of it proves the **mechanism**: that operational signals on local-business accounts actually predict who closes. This retro is how you prove the mechanism on real data — your own pilot data, or a design partner's (FineDine).

If you can show "accounts with signature X close at 82% vs a 31% baseline," Revint stops being CRM enrichment and becomes a learning system. That is the slide a VC or a CRO remembers.

---

## What you are testing

> Do specific, machine-detectable operational signals correlate with closed-won outcomes inside one vertical — strongly enough to re-rank a list?

You are NOT trying to prove causation or build a model yet. You are looking for **lift**: signal-present win rate vs. baseline win rate, on a real deal set.

---

## Inputs you need

1. **Closed deals, last 12–18 months**, one vertical at a time (start with FineDine's restaurant set).
   - Pull from HubSpot: `dealstage = closed-won OR closed-lost`, with the associated company.
   - Minimum useful sample: ~40 decided deals per vertical. Below that, report it as directional only.
2. **Operational signals per account**, captured the way Revint would have seen them *at the time of the deal* (avoid hindsight leakage):
   - vertical software signature (e.g. OpenTable Lite, Toast, Square)
   - location count + recent expansion (new locations in last 90 days)
   - review tone / rating delta (e.g. 4.7 → 3.8 over 6 months)
   - owner activity (hiring posts, ownership change)
   - booking-friction signal from reviews
3. **The outcome** for each: won / lost, and time-to-close for the wins.

---

## Method

1. Compute the **baseline win rate** for the vertical: `wins / (wins + losses)` across all decided deals.
2. For each candidate signal, split deals into signal-present vs. signal-absent.
3. Compute win rate for each group and the **lift**: `present_win_rate − baseline`.
4. Keep signals with meaningful lift and a real sample behind them. Discard anything with < ~8 decided deals on the present side — note it as "watchlist," not "pattern."
5. Combine the 2–3 strongest signals into a **pattern signature** and re-run the win rate on the intersection. This is the number that sells.
6. Assign an evidence tier (mirrors the OI EvidenceSystem in the product):
   - **T1** — raw observed counts (won/lost on real records).
   - **T2** — rule-based pattern (signature defined from T1 counts).
   - **T3** — model inference (must be backed by T1/T2; never stand-alone).
   - **T4** — assumption (cannot ship alone).

---

## Output table (fill this in)

### Per-signal lift

| Signal | Deals (present) | Won | Lost | Win rate | Baseline | Lift | Evidence |
|---|---|---|---|---|---|---|---|
| OpenTable Lite install | | | | | | | T1 |
| 4+ locations | | | | | | | T1 |
| Expansion < 90 days | | | | | | | T1 |
| Rating drop > 0.5 in 6 mo | | | | | | | T1 |
| Owner hiring (ops role) | | | | | | | T1 |

### Pattern signatures (the headline)

| Pattern | Signature | Accounts seen | Won | Lost | Win rate | Avg days-to-close | Evidence |
|---|---|---|---|---|---|---|---|
| #14 | OpenTable Lite + 4+ locations + expansion < 90d | 37 | 9 | 2 | 82% | 19 | T3 |
| | | | | | | | |
| | | | | | | | |

> The `#14` row above is the placeholder used on the homepage `LearnedPatternCard`. Replace it with a real row from the retro before using it with a customer or investor. Until then it is illustrative, not measured.

---

## The investor slide (one screen)

**Title:** Operational signals predict who closes — and we can read them automatically.

**Body:** three lines, no chart needed:

- Baseline restaurant-vertical win rate: `__%` (n = `__` decided deals).
- Accounts matching closed-won pattern #14: `__%` win rate (n = `__`), `__` days to close.
- Revint detects that signature from public signals before the first dial.

**The point:** the team's winning pattern already exists in their closed-won data — it's just trapped in reps' heads and never re-applied. Revint extracts it, scores the next list against it, and writes the result into HubSpot. That is the learning loop, proven on the customer's own numbers.

---

## Honesty guardrails

- Label sample sizes everywhere. A 9-2 split is suggestive, not significant — say so.
- Watch for leakage: only use signals observable *before* the deal closed.
- Report losses too. A pattern that wins 82% and a separate pattern that loses 80% are both valuable; a tool that only shows wins reads as cherry-picking.
- Don't put a measured-looking win rate on the website until it comes from a real retro. The homepage card stays clearly illustrative until then.

---

_Owner: founder + first design partner (FineDine). Re-run per vertical as each pilot accumulates ≥ 40 decided deals._
