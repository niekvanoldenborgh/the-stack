# Spec: estimated medication levels (PK) + the no-dosage boundary

**Issue:** THEA-6 · **Parent:** THEA-4 · **Owner:** Product & Safety · **Status:** draft, awaiting medical sign-off
**Gates:** the Summary page "estimated medication levels" chart, and the Logger's peptide:water ratio display.
**No app code ships against this document until the items in §7 are signed off by the human medical owner.**

---

## 0. What this document decides

1. A concrete, implementable PK model for semaglutide and tirzepatide, with every parameter traced to a peer-reviewed paper or an FDA label (§1).
2. How uncertain those curves are, and the exact words that must sit next to them (§2).
3. The line between *calculating* and *recommending* — what the Logger and Summary may compute, and what they must never originate (§3).
4. Which of the 31 compounds in `src/domain/peptides` get a curve, and what the other 29 show instead (§4).
5. Test obligations (§5), open calibration questions (§6), and the medical sign-off list (§7).

**The one-line summary of the boundary:** the app has *advisory* surfaces (the recommendation engine, which does produce a number under the existing `src/engine/dosing.ts` gates) and *instrument* surfaces (Logger, Summary, reconstitution). **Instrument surfaces never originate a dose.** They do arithmetic on numbers the user typed, and they display the result with its units. That is the whole of "we do not suggest dosages ourselves, we only supply the calculations."

---

## 1. The PK model

### 1.0 Design decisions that apply to both compounds

**D1 — Superposition over logged injections, not over a schedule.**
The curve is built by summing the single-dose contribution of each injection the user has *actually logged*, at the time they logged it. It is never built from the planned schedule, and never from a dose the app computed. This falls out of §3 and it also handles the hard case for free: titration, missed doses, an early dose, a dose the user changed on their own.

```
C_total(t) = Σ over logged injections i, where t ≥ t_i:  C_single(D_i, t − t_i)
```

**D2 — One canonical internal unit, conversions only at the boundary.**
The engine works in **mg** for dose, **L** for volume, **h** for time, and reports **mg/L (= µg/mL = ng/mL ÷ 1000)**. `Peptide.dosing.unit` is authoritative for what the user typed; conversion happens once, explicitly, at the point where a `Dose` enters the model, and the resulting figure carries its unit everywhere it is displayed. See §3.4 (invariant 8).

**D3 — Apparent parameters, so `F` is not applied twice.**
Semaglutide's published parameters are apparent (`CL/F`, `V/F`); the dose goes in as-is. Tirzepatide's are true parameters with `F` fixed at 0.8; `F` must be applied explicitly. Getting this wrong is a 25% error in one direction. It is called out again in each subsection.

**D4 — Body weight is the only personalisation.**
Both source models found body weight to be the only covariate with a clinically relevant effect on exposure. Nothing else the app knows about the user (age, sex, activity, experience, the risk dial) may touch the PK curve. In particular **the risk dial must not be an input to this model** — AGENTS.md invariant 2 says the dial affects dose and nothing else, and a dial that changed the drawn curve would be exactly the kind of quiet second effect that invariant exists to prevent.

---

### 1.1 Semaglutide

**Structural model:** one compartment, first-order absorption and first-order elimination, subcutaneous.
**Source:** Carlsson Petri KC, Ingwersen SH, Flint A, Zacho J, Overgaard RV. *Semaglutide s.c. Once-Weekly in Type 2 Diabetes: A Population Pharmacokinetic Analysis.* Diabetes Ther. 2018;9(4):1533–1547. doi:10.1007/s13300-018-0458-5. (Open access, PMC6064581.)

#### Parameters

| Parameter | Value | Basis | Citation |
|---|---|---|---|
| Structural model | 1-compartment, 1st-order absorption + elimination | popPK, n = 1,612, SUSTAIN 1–5 + phase 2 | Carlsson Petri 2018 |
| `ka` | **0.0286 h⁻¹** | *Fixed* in the analysis from clinical-pharmacology trial data, not estimated | Carlsson Petri 2018 |
| `CL/F` | **0.0478 L/h** at the 85 kg reference subject | popPK estimate | Carlsson Petri 2018 |
| `V/F` | **12.2 L** | popPK estimate; the paper states no covariate effects were included on `V/F` | Carlsson Petri 2018 |
| Reference weight | **85 kg** | Reference subject definition | Carlsson Petri 2018 |
| Weight effect on `CL/F` | `(WT/85)^0.78` — **derived, see below** | Derived from the paper's reported exposure differences | Carlsson Petri 2018 + arithmetic in this doc |
| Between-subject variability, `CL/F` | 26.6% base model → **12.9%** with weight | popPK | Carlsson Petri 2018 |
| Absolute bioavailability | 89% (already inside `CL/F` and `V/F` — **do not apply again**) | Label §12.3 | WEGOVY USPI, §12.3 |
| `tmax`, single dose | 1–3 days | Label §12.3 | WEGOVY USPI, §12.3 |
| Volume of distribution | ≈ 12.5 L | Label §12.3 (cross-check on the 12.2 L above) | WEGOVY USPI, §12.3 |
| Apparent clearance | ≈ 0.05 L/h | Label §12.3 (cross-check on the 0.0478 above) | OZEMPIC USPI, §12.3 |
| Elimination half-life | ≈ 1 week | Label §12.3 | OZEMPIC / WEGOVY USPI, §12.3 |
| Time to steady state | 4–5 weeks of once-weekly dosing | Label §12.3 | OZEMPIC USPI, §12.3 |
| Molecular weight | 4113.58 g/mol (C₁₈₇H₂₉₁N₄₅O₅₉) | Label §11 Description | OZEMPIC / WEGOVY USPI, §11 |

**On the weight exponent.** The paper does not print the numeric exponent; it reports the covariate *form* — `E_weight = (WT/85)^θ_wt` — and the resulting exposure differences: a 55 kg subject has "on average a 40% increased semaglutide exposure" and a 127 kg subject "27% lower semaglutide exposure" versus the 85 kg reference. Since exposure ∝ 1/CL:

```
55 kg:  CL ratio = 1/1.40 = 0.714;  θ = ln(0.714)/ln(55/85)  = (−0.3365)/(−0.4353) = 0.773
127 kg: CL ratio = 1/0.73 = 1.370;  θ = ln(1.370)/ln(127/85) = ( 0.3147)/( 0.4015) = 0.784
                                                       →  θ_wt ≈ 0.78
```

This is a *derivation from published figures*, not an invented number, and the two independent anchors agreeing to within 0.011 is reassuring. It is still a derivation: **MED-SIGNOFF-2** below asks the owner to either accept 0.78 or substitute the conventional fixed allometric 0.75 (which changes predicted exposure by under 2% across 50–150 kg and is therefore a low-stakes choice).

#### Equations

```
CL_i = 0.0478 · (WT/85)^0.78        [L/h]      (WT clamped to 40–200 kg, §1.3)
V_i  = 12.2                          [L]
ke   = CL_i / V_i                    [h⁻¹]
ka   = 0.0286                        [h⁻¹]

Single dose D (mg), t in hours since that injection:

              D · ka
C(t) =  ─────────────────── · ( e^(−ke·t) − e^(−ka·t) )      [mg/L]
          V_i · (ka − ke)
```

`D` is the dose as administered — no `F` factor, because `CL/F` and `V/F` already carry it (D3).

#### Derived values at the 85 kg reference (implementation self-check)

| Quantity | Value |
|---|---|
| `ke` | 0.0478 / 12.2 = **0.003918 h⁻¹** |
| Elimination half-life | ln2 / 0.003918 = **176.9 h = 7.37 days** (label: "approximately 1 week" ✓) |
| Absorption half-life | ln2 / 0.0286 = 24.2 h |
| `tmax` single dose | ln(ka/ke)/(ka − ke) = **80.5 h = 3.4 days** (label: 1–3 days — see §6, CAL-3) |
| Accumulation ratio, weekly | 1/(1 − e^(−ke·168)) = **2.07** |
| `Cavg,ss`, 1.0 mg weekly | D/(CL·τ) = 1/(0.0478·168) = **0.1245 mg/L = 30.3 nmol/L** |
| `AUCτ,ss`, 2.0 mg weekly | 2/0.0478 = 41.8 mg·h/L = **10,171 nmol·h/L** |

The last row is the model's external calibration check: published steady-state `AUCτ` for once-weekly 2.0 mg semaglutide is ≈ 9,825 nmol·h/L, so the model is **3.5% high**. Substituting the label's rounded `CL/F` of 0.05 L/h instead gives 9,724 nmol·h/L, **1.0% low** — the published figure sits between the two, which is about as good as this gets. Note that the attribution of that published figure to the 2.0 mg strength is *inferred* from dose-proportionality, not read off the label directly — confirming it is **CAL-1** in §6.

---

### 1.2 Tirzepatide

**Structural model:** two compartments, first-order absorption and elimination, subcutaneous.
**Source:** Schneck K, Urva S. *Population pharmacokinetics of the GIP/GLP receptor agonist tirzepatide.* CPT Pharmacometrics Syst Pharmacol. 2024;13(3):494–503. doi:10.1002/psp4.13099. (39,644 observations from 5,802 participants across 19 pooled studies.)

#### Parameters

| Parameter | Value (95% CI) | IIV | Citation |
|---|---|---|---|
| Structural model | 2-compartment, 1st-order absorption + elimination | — | Schneck 2024 |
| Bioavailability `F` | **0.8 (fixed)** — **must be applied explicitly** | — | Schneck 2024, Table 3 |
| `ka` | **0.0373 h⁻¹** (0.0289–0.0460) | 22.5% | Schneck 2024, Table 3 |
| `CL` | **0.0329 L/h per 70 kg** (0.0313–0.0342) | 14.2% | Schneck 2024, Table 3 |
| `Q` (intercompartmental) | **0.126 L/h per 70 kg** (0.101–0.144) | — | Schneck 2024, Table 3 |
| `Vc` (central) | **2.47 L per 70 kg** (2.05–2.92) | 49.0% | Schneck 2024, Table 3 |
| `Vp` (peripheral) | **3.98 L per 70 kg** (3.56–4.21) | — | Schneck 2024, Table 3 |
| Allometric exponent, clearances | **0.8 (fixed)** | — | Schneck 2024 |
| Allometric exponent, volumes | **1.0 (fixed)** | — | Schneck 2024 |
| Fat-mass-fraction effect on Vd | 0.482 (0.447–0.524) | — | Schneck 2024 — **not used in v1, see below** |
| Reference weight | **70 kg** | — | Schneck 2024 |
| Absolute bioavailability | 80% | — | ZEPBOUND USPI, §12.3 |
| `tmax` | 8–72 h | — | ZEPBOUND USPI, §12.3 |
| Apparent Vd,ss | ≈ 10.3 L | — | ZEPBOUND USPI, §12.3 |
| Apparent clearance | ≈ 0.061 L/h | — | ZEPBOUND USPI, §12.3 — **see CAL-2** |
| Half-life | ≈ 5 days | — | ZEPBOUND USPI, §12.3 |
| Time to steady state | 4 weeks of once-weekly dosing | — | ZEPBOUND USPI, §12.3 |
| Plasma protein binding | 99% (albumin) | — | ZEPBOUND USPI, §12.3 |
| Molecular weight | 4813.53 g/mol (C₂₂₅H₃₄₈N₄₈O₆₈) | — | ZEPBOUND USPI, §11 |

**On the fat-mass-fraction covariate.** It acts on volume of distribution only, and the app cannot reliably obtain body composition (`UserProfile.bodyFatPct` is optional and self-reported). Excluding it shifts the *shape* of the distribution phase slightly and does not affect `Cavg,ss` at all, which is a function of clearance. **v1 omits it**; the omission is disclosed in the long-form uncertainty copy. **MED-SIGNOFF-3.**

#### Equations

```
CL_i = 0.0329 · (WT/70)^0.8      [L/h]
Q_i  = 0.126  · (WT/70)^0.8      [L/h]
Vc_i = 2.47   · (WT/70)          [L]
Vp_i = 3.98   · (WT/70)          [L]
ka   = 0.0373                    [h⁻¹]
F    = 0.8

k10 = CL_i/Vc_i ;  k12 = Q_i/Vc_i ;  k21 = Q_i/Vp_i

α, β = roots of  x² − (k10+k12+k21)·x + k10·k21 = 0,  with α > β

Single dose D (mg), t in hours since that injection:

C(t) = A·e^(−α·t) + B·e^(−β·t) + K·e^(−ka·t)      [mg/L]

        F·D·ka      (k21 − α)              F·D·ka      (k21 − β)              F·D·ka      (k21 − ka)
A =  ─────────  · ───────────────    B =  ─────────  · ───────────────   K =  ─────────  · ───────────────
          Vc_i     (ka−α)(β−α)                  Vc_i    (ka−β)(α−β)                 Vc_i     (α−ka)(β−ka)
```

Implementations must assert `A + B + K ≈ 0` (it is `C(0)` for an extravascular dose); it is the cheapest possible catch for a transcription error in the coefficients.

#### Derived values at the 70 kg reference (implementation self-check)

| Quantity | Value |
|---|---|
| `k10` | 0.0329 / 2.47 = 0.013320 h⁻¹ |
| `k12` | 0.126 / 2.47 = 0.051012 h⁻¹ |
| `k21` | 0.126 / 3.98 = 0.031658 h⁻¹ |
| `α` | **0.091375 h⁻¹** → distribution half-life 7.6 h |
| `β` | **0.004615 h⁻¹** → terminal half-life **150.2 h = 6.26 days** |
| Absorption half-life | 18.6 h |
| `Cavg,ss`, 5 mg weekly @ 70 kg | F·D/(CL·τ) = 4/(0.0329·168) = **0.724 mg/L = 150 nmol/L** |
| Coefficients for D = 5 mg @ 70 kg | A = −0.7689, B = +0.5760, K = +0.1928 mg/L (sum = −0.00002 ✓) |

The terminal β half-life of 6.26 days is longer than the label's "approximately 5 days", which is expected — the label figure is an *effective* (accumulation-based) half-life, and for a two-compartment drug that is routinely shorter than the terminal slope. This is a known and acceptable discrepancy, but it must not be presented to the user as "your half-life is 6.3 days" while the label says 5; see §2.4.

---

### 1.3 Guard rails on the model itself

| Guard | Rule | Why |
|---|---|---|
| Weight domain | Clamp `WT` to **40–200 kg** before scaling. Outside that, fall back to the reference weight and add a note. | Allometric extrapolation past the observed range is invention. Matches the spirit of AGENTS.md invariant 1. |
| Missing weight | `UserProfile.weightKg` absent → use the source model's reference weight (85 kg / 70 kg) and say so in the caption. | Never silently guess a personal number. |
| Time horizon | Do not draw beyond **5 terminal half-lives** past the last logged injection. | Past that the curve is a flat line at ~3% and reads as "still on drug". |
| Dose domain | The model is linear and both drugs are dose-proportional across their label ranges. If a logged dose exceeds `dosing.hardMax`, still compute (the arithmetic is honest) but attach the over-cap warning from §3.3. | Never falsify the user's own record. |
| Numerical | Evaluate at ≥ 1 sample/hour for the drawn window; do not interpolate across a dose event. | A weekly-grid sample can miss the peak entirely. |
| Route | Model is for **subcutaneous** only. Both compounds are SC-only in `routes`, so this is currently vacuous — it becomes load-bearing if oral semaglutide is ever added, whose PK is completely different. | Oral semaglutide is a different absorption model and a different bioavailability by two orders of magnitude. |

---

## 2. Uncertainty framing and required copy

### 2.1 What the error actually is

Ranked by size, largest first:

1. **Product content (non-pharmacy supply).** For anything not dispensed by a pharmacy, the actual peptide mass in the vial is unverified. `metabolic.ts` already records that grey-market semaglutide is a recurring source of dosing errors. A vial containing 60% of its label claim produces a curve that is 40% wrong before any PK enters the picture. **This dominates every other error term and the copy must say so.**
2. **Reconstitution and measurement error.** Under-2-unit draws on a U-100 syringe — already warned about in `reconstitute()` — carry double-digit percentage error.
3. **Between-subject PK variability.** The honest, sourced numbers: semaglutide `CL/F` BSV 12.9% after accounting for weight; tirzepatide `CL` IIV 14.2%, `Vc` IIV 49.0%, `ka` IIV 22.5%. Roughly, a 14% CV on clearance puts a realistic 90% interval on steady-state level at about **×/÷ 1.25** — i.e. a person's true level is commonly 25% either side of the drawn line, before points 1 and 2.
4. **Model omissions.** Fat-mass fraction (tirzepatide), the semaglutide weight exponent being derived, no covariate on semaglutide `V/F`.
5. **Adherence timing.** The curve assumes the logged injection time is the true one.

### 2.2 Required display rules

| Rule | Detail |
|---|---|
| **U1. Normalised y-axis by default** | The primary chart is **"% of your steady-state average"**, not ng/mL. Normalising by the user's own predicted `Cavg,ss` cancels the absolute clearance scale, which makes the unresolved calibration questions in §6 non-load-bearing for v1 and removes a number users will otherwise compare against strangers on forums. |
| **U2. Absolute concentration is gated** | An ng/mL axis may only ship after CAL-1 and CAL-2 are closed and the §5 calibration test passes. |
| **U3. Uncertainty band, always** | Draw a shaded band, never a bare line. v1 band = ×/÷ 1.25 on the level (from §2.1 point 3), labelled as *typical between-person variation only*. A single crisp line implies a measurement. |
| **U4. No therapeutic range, no target line, no zones** | No "in range" band, no goal marker, no red/amber/green regions. A zone is a dose recommendation wearing a chart's clothing. This also protects the palette rule in AGENTS.md — colour in this app carries severity meaning, and the brand accent is deliberately kept clear of the severity scale. |
| **U5. Single hue** | Follow the existing chart convention: small multiples and single hues, one per compound, never a categorical palette. |
| **U6. Disclaimer is persistent, not dismissible** | The short disclaimer (§2.3) is part of the chart, not a tooltip. It survives scrolling and screenshotting. |
| **U7. No predicted future beyond logged doses** | The curve may extend forward only as decay from what has been logged. It must not draw the effect of a *planned* future injection, because that would be the app asserting a future dose. |

### 2.3 Required copy — verbatim

**Short disclaimer (persistent, directly under the chart):**

> Estimate from population-average study data — not a measurement of your blood.

**Chart caption (one line, under the short disclaimer):**

> Modelled from the injections you logged, scaled to your body weight. Real levels vary between people, and vary a lot more if your vial's contents are not what the label says.

**Long form (info sheet, reached by tapping the caption):**

> **How this estimate is made**
>
> We take the injections you logged and run them through a pharmacokinetic model built from published clinical-trial data — the same kind of model used to choose the dosing intervals on the label. For semaglutide and tirzepatide, the parameters come from peer-reviewed population analyses of thousands of trial participants. The only thing about you that goes into it is your body weight, because that is the only personal factor those studies found to have a meaningful effect.
>
> **What it is not**
>
> It is not a blood test. It is the average behaviour of a large group of people, drawn as if it were yours. Two people at the same dose and the same weight can genuinely differ by 25% or more, and this chart cannot tell you where in that spread you sit. Only a blood test can.
>
> **The biggest source of error is not the model**
>
> If your product did not come from a pharmacy, nobody has verified how much peptide is actually in the vial. If it contains less than the label says — or more — this chart is wrong by that amount, and no amount of modelling can detect it.
>
> **What this chart is for**
>
> Seeing the shape: how long a compound takes to build up, what a missed or late injection does to it, and how long it stays in you after you stop. It is not for deciding a dose. We do not suggest doses.
>
> **Sources**
>
> Semaglutide: Carlsson Petri et al., *Diabetes Ther* 2018;9(4):1533–1547; Ozempic and Wegovy US prescribing information, §12.3.
> Tirzepatide: Schneck & Urva, *CPT Pharmacometrics Syst Pharmacol* 2024;13(3):494–503; Zepbound US prescribing information, §12.3.

**First-time modal (shown once before the chart is first revealed, requires an explicit acknowledgement):**

> **Before you read this chart**
>
> This is a model, not a measurement. It shows what a population average would look like on your logged injections and your body weight.
>
> It cannot tell you whether your dose is right, and we will never use it to suggest one. If you are deciding anything about your dose, that is a conversation with a prescriber, with a blood test in hand.

**"No model available" state (§4 tier 3):**

> **No level estimate for {compound}**
>
> We only draw this chart where published human pharmacokinetic data exists to build it from — which currently means semaglutide and tirzepatide. For {compound} we would have to invent the numbers, so we don't. Your injections are still logged and still shown on the calendar.

**Short-half-life variant (tesamorelin, teriparatide, the GH secretagogues):**

> **No level estimate for {compound}**
>
> This compound clears in {hours} — it is out of your system long before the next dose, so a level chart would be a flat line with a spike on it and would tell you nothing useful. What matters for this compound is the response it triggers, not the level of the peptide itself.

### 2.4 Copy prohibitions

Never, on any PK surface:

- A number without a unit.
- "Your half-life is …" — it is the population's, and for tirzepatide the terminal and effective values differ (§1.2).
- "Optimal", "therapeutic", "in range", "too low", "too high", "you should".
- Any sentence where the subject of the verb is the app and the object is a dose.
- A comparison of the user's curve to another user's, or to a cohort percentile.

---

## 3. The no-dosage boundary

### 3.1 Surface classes

| Class | Surfaces | May a dose number originate here? |
|---|---|---|
| **Advisory** | Builder / recommendation screen, `src/engine/dosing.ts` `computeDose` | Yes — under the existing invariants (published-band interpolation, low-first/ceiling-second clamp, withholding). Unchanged by this spec. |
| **Instrument** | Injection Logger, peptide:water ratio display, Summary "estimated medication levels" | **No.** Never. |
| **Reference** | Library / peptide detail | Published figures only, attributed to the label or trial, phrased as reportage. |

Everything below is about the **instrument** class.

### 3.2 What instrument surfaces MAY compute and display

All inputs marked **(user)** are typed by the user and never prefilled with a computed value.

| # | Calculation | Inputs | Output |
|---|---|---|---|
| C1 | **Concentration from reconstitution** | vial peptide mass mg **(user)**, bacteriostatic water mL **(user)** | mg/mL, and mcg per unit on a U-100 syringe. Already implemented as `reconstitute()` in `src/engine/dosing.ts:332`. |
| C2 | **Volume to draw for a dose** | C1 concentration, dose **(user)** with its unit | mL and U-100 units, rounded to a measurable increment |
| C3 | **Peptide:water ratio display** | C1 inputs | e.g. `5 mg in 2.0 mL = 2.5 mg/mL = 250 mcg per 10 units`. Every equivalent form carries its unit — see §3.4. |
| C4 | **Doses per vial / days of supply** | C1 inputs, dose **(user)**, logged frequency | integer count, date |
| C5 | **Measurability warnings** | C2 result | the existing `<2 units` and `>100 units` warnings |
| C6 | **PK curve** | logged injections **(user)**, `weightKg` **(user)** | §1 |
| C7 | **Time since / until** | logged injections | "last dose 3 days ago", "next scheduled dose in 4 days" — schedule, not amount |
| C8 | **Published range, quoted** | `Peptide.dosing` + `sources` | "The label's maximum is 2.4 mg per week." Reportage, attributed, never phrased as advice. |

### 3.3 What instrument surfaces MUST NEVER do

| # | Prohibition | Rationale |
|---|---|---|
| P1 | Prefill, suggest, autocomplete or default a dose field to any computed value — including the user's own last dose as a *suggestion*. (Repeating a previous entry as an explicitly labelled "same as last time" *action the user taps* is fine; a silently pre-populated number is not.) | A prefilled number is a recommendation with the accountability filed off. |
| P2 | Compute a "next" dose, a titration step, or an escalation date on the Logger or Summary. | Titration advice lives in the advisory class and its gates. |
| P3 | Solve C2 backwards — i.e. take a *volume* the user wants to draw and hand back the dose it corresponds to as a suggestion. The arithmetic is identical; the framing is not. Displaying "10 units = 250 mcg" as a *conversion table* is fine. Presenting it as an answer to "what should I draw" is not. | The direction of the question is what makes it a recommendation. |
| P4 | Clamp, round, or silently correct a **dose the user entered**. Round the *volume*; never the dose. | Falsifying the log is worse than an odd number, and the log is what the PK curve and the side-effect correlation are built on. |
| P5 | Draw a PK curve, or a level number, for a `doseGuidanceWithheld` compound. | AGENTS.md invariant 4. See MED-SIGNOFF-1 for the one part of this that is a judgement call. |
| P6 | Convert between mg and mcg — or mg and IU — anywhere the source unit is not explicit on the `Dose`. | AGENTS.md invariant 8. |
| P7 | Show a curve that implies the user is above or below where they "should" be. | §2.2 U4. |
| P8 | Block, or refuse to log, a dose above `hardMax`. It warns — loudly, naming the published maximum and its source — and logs what the user typed. | Only critical safety findings block, per AGENTS.md invariant 6; and a user who has already injected needs the log to be true. |

### 3.4 Mapping onto the AGENTS.md safety invariants

**Invariant 4 — `doseGuidanceWithheld`.**
Extended by this spec: a withheld compound gets **no PK curve, no level number, no `Cavg,ss`, no accumulation figure** (P5). The extension is not automatic from the existing wording — the invariant is about *the app producing a dose number*, and a curve computed from the user's own logged dose is arguably not that. We are extending it anyway, because a level chart is read as validation, and validating a compound we refuse to dose-guide is incoherent. **The reconstitution calculator (C1–C3, C5) remains available for withheld compounds**, because it is pure harm reduction: the user has already decided and already has the vial, and the failure mode it prevents — a 10× syringe error — is the one that puts people in hospital. This split is **MED-SIGNOFF-1**.

**Invariant 8 — no implicit unit conversion.**
The existing `reconstitute()` converts mg → mcg internally (`dosing.ts:340`, `dosing.ts:345`), but only from an explicit `Dose.unit` discriminant, and it returns `null` for `iu` and `pct` rather than guessing. That is compliant and must stay that way. This spec adds two obligations: (a) the PK engine's canonical internal unit (D2) is converted at the boundary only, from an explicit `dosing.unit`, and never inferred from magnitude; (b) the C3 ratio display must show **every** equivalent form with its unit spelled out in the same string, because the peptide:water display is precisely where a user re-derives a number under pressure with a syringe in hand.

**Invariants 2 and 3 — low-first, ceiling-second clamping, and rounding that cannot escape the cap.**
These are **advisory-class invariants and they do not transfer to instrument surfaces** — there is nothing to clamp, because the number is the user's, not ours (P4). The instrument-class equivalents are:

- Rounding applies to **volume**, never to dose. A dose of 1.7 mg stays 1.7 mg; the 6.8 units it corresponds to may be shown as 6.8.
- A volume rounded for measurability must be rounded such that the displayed volume never implies **more** drug than the user entered — round the drawn volume **down** to the syringe increment and state the resulting delivered amount, rather than rounding to nearest and silently over-delivering. This is the instrument-surface analogue of "rounding must not escape the cap".
- Over-`hardMax` entries warn and log (P8); they are never clamped.

**Invariant 2 (the risk dial) —** the dial is not an input to any calculation in this spec (D4).

**Invariant 6 — critical findings block saving.** Unchanged. A PK curve never blocks anything and is never a gate.

---

## 4. Per-compound eligibility

### 4.1 The decision procedure

A compound gets a PK curve **only if all six hold**:

- **E1 — Sourced parameters.** Published human PK giving enough to parameterise a curve: at minimum clearance *and* volume (or an explicitly published compartmental model), from a peer-reviewed paper or a regulator-approved label. A half-life alone is **not** enough — it fixes the shape's decay but not its scale, and shipping a curve with an invented scale is exactly the failure mode this spec exists to prevent.
- **E2 — Systemic route the app can quantify.** Subcutaneous, intramuscular, or oral with published bioavailability. Topical is out: the app knows a % strength, not a delivered mass.
- **E3 — Not `doseGuidanceWithheld`.** (§3.4, MED-SIGNOFF-1.)
- **E4 — Mass dosing unit.** `mg` or `mcg`. `iu` is out — IU→mg is product-specific and converting it would breach invariant 8. `pct` is out by E2.
- **E5 — Half-life ≥ ~12 h.** Below that the compound is gone before the next dose and a weekly chart is a flat line with spikes on it; the honest display is the §2.3 short-half-life copy.
- **E6 — The level is the meaningful quantity.** For GH secretagogues and GHRH analogues the informative variable is the downstream GH/IGF-1 response, not the peptide concentration. A peptide-level chart there would be technically true and clinically misleading.

### 4.2 The result — 2 of 31 compounds are eligible

**Tier 1 — ships a curve (2)**

| Compound | Model |
|---|---|
| `semaglutide` | §1.1 |
| `tirzepatide` | §1.2 |

**Tier 2 — no curve in v1, but a real candidate if the owner wants it later (2)**

| Compound | Blocked by | Note |
|---|---|---|
| `retatrutide` | E1 | Half-life ~5–7 days is published (phase 1/2), but no clearance/volume pair is. Would become Tier 1 the day a popPK analysis publishes. Unapproved, so §2 copy would need strengthening. |
| `cjc-1295-dac` | E1, E6 | The only GH-axis compound with a long enough half-life (albumin-bound, days) for a curve to be legible, but there is no published human popPK, and E6 still applies. |

**Tier 3 — "no model available" (27)**

| Compound | First failing gate |
|---|---|
| `tesamorelin` | E5 — clears in well under an hour; use the short-half-life copy |
| `teriparatide` | E5 — subcutaneous half-life about an hour; short-half-life copy |
| `somatropin` | E3 (withheld) **and** E4 (`iu`) |
| `igf-1-lr3` | E3 (withheld) |
| `follistatin-344` | E3 (withheld) |
| `ipamorelin`, `mod-grf-1-29`, `sermorelin`, `ghrp-2`, `ghrp-6`, `hexarelin` | E5 and E6 — minutes-long half-lives, and the GH pulse is the point |
| `mk-677` | E5 (borderline, hours) and E6 — the informative readout is IGF-1 |
| `bpc-157`, `tb-500`, `mots-c`, `aod-9604`, `epitalon`, `dsip`, `kpv`, `thymosin-alpha-1`, `melanotan-2`, `5-amino-1mq` | E1 — no published human PK sufficient to parameterise a model |
| `ghk-cu`, `matrixyl`, `argireline`, `zinc-thymulin`, `ptd-dbm` | E2 and E4 — topical, `pct` dosing |

**Design note for the Library.** Tier 3 is 27 of 31 compounds, so the "no model available" state is not an edge case — it is the majority experience and must be designed as a first-class state, not an empty-chart fallback. Handled well it is one of the app's more credible moments: the reason there is no chart is that we will not draw one from numbers we do not have.

### 4.3 Implementation shape

Add an optional `pk?: PkModel` field to `Peptide` in `src/domain/types.ts`, present on exactly the Tier 1 compounds; its absence *is* the "no model available" state, so a new compound is safe by default. Put the solver in `src/engine/pk.ts` — pure, no React Native, no store, so it compiles under `tsconfig.test.json` alongside the rest of the engine. The eligibility gates E3/E4 are checkable in a test that walks every peptide; E1/E2/E5/E6 are editorial and live in this document.

---

## 5. Test obligations

To be added to `tests/engine.test.cjs` when the code lands. Per AGENTS.md, these should fail before the behaviour changes.

| # | Test |
|---|---|
| T1 | Every peptide with a `pk` model is not `doseGuidanceWithheld` (E3) and has `dosing.unit` in {mg, mcg} (E4). |
| T2 | Exactly `semaglutide` and `tirzepatide` have a `pk` model. Adding a third fails the test until this spec is updated. |
| T3 | **Calibration, semaglutide:** predicted `AUCτ,ss` at 2.0 mg weekly, 85 kg, is within 5% of 9,825 nmol·h/L; terminal half-life is within 5% of 168 h; accumulation ratio is 2.0–2.2. |
| T4 | **Calibration, tirzepatide:** `A + B + K = 0` to 1e-9; terminal half-life is 5–7 days; `Cavg,ss` at 5 mg/70 kg reproduces `F·D/(CL·τ)` to 1e-6. |
| T5 | The risk dial does not change any PK output — byte-identical curves across all five settings (mirrors the existing invariant-2 test). |
| T6 | The curve is a pure function of logged injections; an empty log yields an empty curve, never a projection from the schedule (U7). |
| T7 | Weight outside 40–200 kg falls back to the reference weight and sets the fallback flag. |
| T8 | Feeding a `doseGuidanceWithheld` peptide to the PK entry point returns "no model", never a number (P5). |
| T9 | Volume rounding never rounds up past the entered dose (§3.4). |
| T10 | No instrument-surface function returns a dose value not present in its inputs — enforced by keeping the PK and reconstitution modules free of any import from `computeDose`/`recommend`. |

---

## 6. Open calibration questions

| # | Question | Impact if wrong | Blocks |
|---|---|---|---|
| **CAL-1** | Confirm, from the label PDF, that the published steady-state `AUCτ` ≈ 9,825 nmol·h/L for once-weekly semaglutide is the **2.0 mg** strength. Attribution here is inferred from dose-proportionality, not read directly. | If it is a different strength, the model is off by that ratio on the absolute axis. | Absolute ng/mL axis (U2). Does **not** block the normalised axis. |
| **CAL-2** | Reconcile tirzepatide's label apparent clearance (0.061 L/h) with the popPK model (`CL` 0.0329 L/h/70 kg, `F` 0.8 → `CL/F` 0.0411 L/h at 70 kg). Back-solving the allometry, 0.061 L/h implies a ~115 kg subject, which is heavier than the trial populations. The two figures do not reconcile on weight alone. | The absolute level scale for tirzepatide differs by up to ~1.5× depending on which is used. Shape and normalised axis are unaffected. | Absolute ng/mL axis (U2). |
| **CAL-3** | Semaglutide model `tmax` computes to 3.4 days against a label range of 1–3 days. Likely a consequence of `ka` being fixed rather than estimated. Decide whether to accept, or to re-fit `ka` against the label `tmax` (which would mean departing from the published parameter set — this spec's default is **accept and disclose**, because a fitted `ka` would be our number, not a cited one). | Peak position off by ~half a day; peak height slightly low. Minimal at a weekly-view scale. | Nothing; disclosure only. |

**None of CAL-1/2/3 block v1**, because v1 ships the normalised axis (U1), which is invariant to the absolute clearance scale. That is the main reason for choosing it.

---

## 7. For the human medical owner — sign-off list

| # | Decision | Recommendation | Consequence of the other choice |
|---|---|---|---|
| **MED-SIGNOFF-1** | For `doseGuidanceWithheld` compounds: no PK curve, but keep the reconstitution/volume calculator. | Accept the split. | Removing the calculator too pushes users to do the mg→units arithmetic themselves, which is the highest-frequency route to a 10× overdose in this space. |
| **MED-SIGNOFF-2** | Semaglutide weight exponent: use the derived 0.78, or the conventional fixed allometric 0.75. | Derived 0.78 (traceable to the source paper's own reported exposures). | <2% difference in predicted exposure across 50–150 kg; low stakes either way. |
| **MED-SIGNOFF-3** | Omitting tirzepatide's fat-mass-fraction covariate on Vd in v1. | Omit and disclose — the app cannot obtain reliable body composition. | Including it would require a mandatory, self-reported body-fat input whose error likely exceeds the covariate's effect. |
| **MED-SIGNOFF-4** | Normalised ("% of steady state") axis for v1, absolute ng/mL gated on CAL-1/CAL-2. | Accept. | An absolute axis invites cross-user comparison of a number that is population-average, and makes CAL-1/2 blocking. |
| **MED-SIGNOFF-5** | The ×/÷ 1.25 uncertainty band (U3) as the v1 default. | Accept as a floor. It reflects PK variability only and *understates* total error, which is why product-content uncertainty is called out separately in the copy rather than folded into the band. | A wider band that mixed in product-content uncertainty would be a made-up number. |
| **MED-SIGNOFF-6** | All §2.3 copy, verbatim — particularly the first-run modal and the "no model available" strings. | Review as clinical-facing copy. | — |
| **MED-SIGNOFF-7** | The Tier 1/2/3 split in §4.2, especially the exclusions of tesamorelin, teriparatide and mk-677 on E5/E6 despite published human PK existing. | Accept. | Including them means shipping charts that are technically correct and clinically uninformative. |
| **MED-SIGNOFF-8** | Confirm that quoting a published maximum (C8) is acceptable reportage and not a dose suggestion under the THEA-4 boundary. | Accept with the mandatory attribution phrasing. | If rejected, the Library loses the published-range display and users get that number from worse sources. |

---

## 8. References

1. Carlsson Petri KC, Ingwersen SH, Flint A, Zacho J, Overgaard RV. **Semaglutide s.c. Once-Weekly in Type 2 Diabetes: A Population Pharmacokinetic Analysis.** *Diabetes Therapy.* 2018;9(4):1533–1547. doi:10.1007/s13300-018-0458-5. PMC6064581. — *Source of: model structure, `ka`, `CL/F`, `V/F`, reference weight, weight covariate form and exposure differences, between-subject variability.*
2. Schneck K, Urva S. **Population pharmacokinetics of the GIP/GLP receptor agonist tirzepatide.** *CPT: Pharmacometrics & Systems Pharmacology.* 2024;13(3):494–503. doi:10.1002/psp4.13099. — *Source of: model structure, `F`, `ka`, `CL`, `Q`, `Vc`, `Vp`, allometric exponents, reference weight, fat-mass covariate, IIV.*
3. **OZEMPIC (semaglutide) injection** — US Prescribing Information, Novo Nordisk, §11 and §12.3. — *Source of: apparent clearance ≈0.05 L/h, half-life ≈1 week, steady state 4–5 weeks, molecular weight and formula.*
4. **WEGOVY (semaglutide) injection** — US Prescribing Information, Novo Nordisk, §12.3. — *Source of: absolute bioavailability 89%, tmax 1–3 days, volume of distribution ≈12.5 L.*
5. **ZEPBOUND (tirzepatide) injection** — US Prescribing Information, Eli Lilly, §11 and §12.3. — *Source of: absolute bioavailability 80%, tmax 8–72 h, Vd,ss ≈10.3 L, apparent clearance ≈0.061 L/h, half-life ≈5 days, steady state 4 weeks, 99% protein binding, molecular weight and formula.*
6. **MOUNJARO (tirzepatide) injection** — US Prescribing Information, Eli Lilly, §12.3. — *Cross-check on reference 5.*

Retatrutide half-life (§4.2, Tier 2) is from the published phase 1 single-/multiple-ascending-dose programme for LY3437943 and the phase 2 obesity trial (*NEJM* 2023;389:514–526, doi:10.1056/NEJMoa2301972); no clearance/volume pair has been published, which is why it is Tier 2 and not Tier 1.

---

## 9. Traceability

| THEA-6 requirement | Section |
|---|---|
| 1. PK model, equations, parameters, citation per parameter | §1.1, §1.2, §8 |
| 2. Uncertainty framing + on-screen disclaimer copy | §2 |
| 3. May-compute vs must-never, mapped to AGENTS.md invariants | §3 |
| 4. Per-compound eligibility | §4 |
| Flag items needing medical sign-off | §7 (8 items), §6 (3 calibration questions) |
