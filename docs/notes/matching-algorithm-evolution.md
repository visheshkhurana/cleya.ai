# How Cleya Matches People — And Why It Gets Smarter as the Network Grows

## The 30-second version

Cleya scores every possible pair of users on a 0–100 compatibility score and only proposes intros above a threshold. The score blends three signals:

| Signal | Weight | What it captures |
|---|---|---|
| Rule-based fit | 35% | Persona pairing, sector overlap, stage compatibility, check-size alignment, location, skills |
| Intent alignment | 35% | What each user said they're looking for ("fundraising", "hiring", "co-founder") and whether the other person fits |
| Semantic similarity | 30% | Cosine similarity between AI embeddings of both profiles — catches things the structured fields miss |

Above 35% becomes a candidate, the top few make it through cadence + paywall + portfolio-conflict checks, and we propose. Each new user expands the candidate pool for everyone else, so quality compounds with density.

---

## The rule-score in detail (the 35% slice)

After the recent fix, the rule-score weights are:

| Sub-signal | Weight | Notes |
|---|---|---|
| **Role match** | 20% | Persona-pair compatibility (e.g. INVESTOR↔FOUNDER = 0.95, RECRUITER↔TALENT = 0.95) |
| **Founder-context fit** | 20% | Stage compatibility, check-size vs raise-size, thesis-overlap for VPs, role-fit for hiring |
| **Industry overlap** | 18% | Jaccard-style overlap between declared industries |
| Location | 8% | Same city > same country > different |
| Skill complementarity | 8% | For co-founder / hiring intent |
| Stage match | 7% | Pre-seed talks to pre-seed/seed, etc. |
| Traction fit | 8% | Revenue / MRR / growth-rate alignment with investor's stage focus |
| Talent prefs | 6% | Comp, role type, remote pref |
| Interest overlap | 5% | Soft signal |

**The critical fix (commit `9b62902`)**: previously `roleMatch` and `founderContextBoost` were each only 12%, so the strongest signal in the system — "this is literally an investor and a founder raising in their stage" — got drowned out by industry overlap (24% weight). That's why a sector-agnostic investor + e-commerce founder scored 42%. After the rebalance, the same pair lands in the 70–80% band.

**The sector-penalty fix**: a 0.75 multiplier was being applied whenever industry overlap was low — *even when one side had no industries declared at all*. A generalist investor (industries=`[]`) was being punished for not matching a vertical-specific founder. Now the penalty only fires when **both** sides have declared industries, so a true sector mismatch still gets penalized, but a generalist no longer does.

---

## Why network density makes this dramatically better

Today, with N users, we evaluate roughly N×(N-1)/2 pairs every cycle. The top-K proposals per user means:

- **Small N (today)**: every user sees almost everyone who matches their persona at all. The top pick may only be a 50–60% match because there isn't yet a 90% match in the pool.
- **Medium N (~500 users)**: each user has 5–10 candidates above 70%. We start being selective.
- **Large N (~5,000+ users)**: top picks routinely cross 85%. The bottleneck shifts from "is anyone a fit?" to "who do we propose first?" — a much better problem.

In other words: the same algorithm that produces a 60% match today produces an 88% match at 5,000 users, with no code change. Density is a direct quality multiplier.

The two things that *don't* scale automatically and need product investment:
1. **Embeddings need refresh as profiles evolve** — handled by the daily safety-net sweep that ensures every complete profile has an up-to-date vector.
2. **Intent drifts** — what a user wanted in month 1 is rarely what they want in month 6. We re-prompt for "what are you looking for now?" every 90 days.

---

## The matrix for iterating on match quality

Match quality is observable. We track and can move three orthogonal dials:

| Dial | What it controls | How to tune |
|---|---|---|
| **Threshold (`minScore`)** | Volume vs precision | Raise it → fewer, higher-quality proposals. Lower it → more variety. Currently 0.35. |
| **Per-user cap** | Cadence vs density | `MATCH_PER_USER_PROPOSE_LIMIT` (currently 3) controls max proposals per tick. Combined with the 36h gap, prevents fatigue. |
| **Weight mix** | Which signal wins ties | The rule/intent/semantic 35/35/30 split. Bump semantic up as the embedding model improves; bump rule up when structured fields are well-populated. |

The feedback loop that makes the system learn:
- Every accepted match → positive signal for that pair-shape (persona pair × sector × stage)
- Every rejected match → negative signal, with optional reason captured
- Every "intro made → meeting happened → outcome reported" closes the highest-quality feedback loop we have

Long-term, these signals can feed a learned re-ranker on top of the rule-based score — but only once we have enough labeled outcomes (~1,000+ accepted/rejected pairs). Until then, hand-tuned weights informed by inspecting individual proposals is the right play.

---

## What changed in the last shipping cycle (April 2026)

1. **Sector-penalty bug fixed** — generalist investors no longer punished for matching specialist founders.
2. **Weights rebalanced** — `roleMatch` and `founderContextBoost` doubled in weight (12% → 20% each); investor↔founder pairs now score where they should.
3. **Cadence layer added** — 36h minimum spacing between proposals for established users; new users get 3 fast matches first.
4. **Both-side counting** — cadence now correctly counts proposals received whether the user was userA or userB on the match.
5. **Match emails redesigned** — smart money formatting (`30000000` → `INR 3 Cr (~$361k)`), proper capitalization, profile-driven subject lines, explicit "want me to make the intro?" CTA, LinkedIn always referenced, RFC 8058 deliverability headers for Primary inbox placement.

---

## What's next (recommended order)

1. **Outcome capture** — currently we know if intros are accepted, but not whether they led to meetings/deals. Add a 7-day-post-intro nudge: "did you and X actually meet?" → store outcome → feed the re-ranker.
2. **Inverse-frequency weighting** — currently a "rare" persona (e.g. an experienced operator) is treated the same as a common one. Boost rare personas slightly so they don't get drowned out as the network scales.
3. **Time-decay on intent** — fundraising priority from 6 months ago shouldn't be treated the same as one declared this week. Decay weight of stale intent fields.
4. **Conflict-of-interest checks** — already detecting basic portfolio conflicts; expand to check fund-level conflicts (LP/GP relationships).
