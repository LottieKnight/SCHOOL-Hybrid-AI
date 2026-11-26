"""
SCHOOL CAPS Curriculum Seed — Mathematics, Physical Sciences, Economics (Gr 10–12)

Usage (from repo root):
  source ~/gpu-env/bin/activate
  python scripts/seed_caps.py                    # all subjects
  python scripts/seed_caps.py --subject maths    # maths only
  python scripts/seed_caps.py --subject physics
  python scripts/seed_caps.py --subject economics
  python scripts/seed_caps.py --grade 12
"""
from __future__ import annotations

import argparse
import os
import sys

from sentence_transformers import SentenceTransformer
from supabase import create_client

from scripts.ingest import _load_env, ingest, chunk_text


# ---------------------------------------------------------------------------
# MATHEMATICS
# ---------------------------------------------------------------------------

MATHS: list[dict] = [
    # ── Grade 10 ──────────────────────────────────────────────────────────
    {
        "metadata": {"subject": "mathematics", "grade": 10, "topic": "algebra",
                     "title": "Algebraic Expressions and Equations — Grade 10 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Algebraic Expressions and Equations — Grade 10 Mathematics (CAPS)

        An algebraic expression contains variables, constants, and operations but no equals sign.
        An equation states that two expressions are equal and can be solved for the variable.

        Expanding and simplifying:
        Use the distributive law: a(b + c) = ab + ac
        FOIL for two binomials: (a + b)(c + d) = ac + ad + bc + bd
        Difference of squares: (a + b)(a - b) = a² - b²
        Perfect square: (a + b)² = a² + 2ab + b²

        Factorisation (the reverse of expanding):
        - Common factor: 3x² + 6x = 3x(x + 2)
        - Difference of squares: x² - 9 = (x + 3)(x - 3)
        - Trinomials: x² + 5x + 6 = (x + 2)(x + 3)
        - Grouping: ax + ay + bx + by = a(x + y) + b(x + y) = (a + b)(x + y)

        Solving linear equations: isolate the variable using inverse operations.
        Example: 3x - 7 = 11 → 3x = 18 → x = 6

        Solving quadratic equations:
        Method 1 — Factorisation: x² - 5x + 6 = 0 → (x - 2)(x - 3) = 0 → x = 2 or x = 3
        Method 2 — Quadratic formula: x = (-b ± √(b² - 4ac)) / 2a
        For ax² + bx + c = 0.
        The discriminant Δ = b² - 4ac tells you the nature of roots:
        Δ > 0: two real unequal roots; Δ = 0: two equal roots; Δ < 0: no real roots.

        Simultaneous equations (two unknowns, two equations):
        Substitution method: solve one equation for one variable, substitute into the other.
        Elimination method: add or subtract equations to eliminate one variable.
        """,
    },
    {
        "metadata": {"subject": "mathematics", "grade": 10, "topic": "functions",
                     "title": "Functions — Linear, Quadratic, Exponential — Grade 10 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Functions — Grade 10 Mathematics (CAPS)

        A function maps each input (x) to exactly one output (y). Written as f(x) or y = ...

        Linear function: y = mx + c
        m = gradient (slope) = rise/run = (y₂ - y₁)/(x₂ - x₁)
        c = y-intercept (where the line crosses the y-axis)
        Gradient positive → line slopes up left to right. Negative → slopes down.
        Parallel lines have equal gradients. Perpendicular lines: m₁ × m₂ = -1

        Quadratic function: y = ax² + bx + c (parabola)
        a > 0: opens upward (smiley face); a < 0: opens downward (sad face)
        Axis of symmetry: x = -b/(2a)
        Turning point (vertex): substitute x into equation to find y.
        x-intercepts: set y = 0 and solve (use factorisation or quadratic formula).
        y-intercept: set x = 0, so y = c.

        Exponential function: y = abˣ (b > 0, b ≠ 1)
        If b > 1: exponential growth. If 0 < b < 1: exponential decay.
        The graph never touches the x-axis (horizontal asymptote at y = 0).
        y-intercept is always (0, a).

        Hyperbola: y = k/x (or y = a/(x - p) + q)
        Has two asymptotes: vertical (x = p) and horizontal (y = q).
        Domain excludes x = p. Range excludes y = q.

        Key skills: reading graphs, finding intercepts, domain and range,
        determining equations from graphs, sketching from equations.
        """,
    },
    {
        "metadata": {"subject": "mathematics", "grade": 10, "topic": "trigonometry",
                     "title": "Trigonometry — Right-Angled Triangles and Special Angles — Grade 10 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Trigonometry — Grade 10 Mathematics (CAPS)

        Trigonometric ratios in a right-angled triangle (angle θ):
        sin θ = opposite / hypotenuse
        cos θ = adjacent / hypotenuse
        tan θ = opposite / adjacent
        Memory aid: SOH CAH TOA

        Reciprocal ratios:
        cosec θ = 1/sin θ
        sec θ = 1/cos θ
        cot θ = 1/tan θ

        Pythagorean identity: sin²θ + cos²θ = 1

        Special angles (memorise these):
        θ = 30°: sin = 1/2, cos = √3/2, tan = 1/√3
        θ = 45°: sin = √2/2, cos = √2/2, tan = 1
        θ = 60°: sin = √3/2, cos = 1/2, tan = √3

        Quadrants and CAST rule (signs of trig ratios):
        Quadrant I (0°–90°): All positive
        Quadrant II (90°–180°): Sine positive only
        Quadrant III (180°–270°): Tangent positive only
        Quadrant IV (270°–360°): Cosine positive only

        Reference angles: the acute angle between the terminal side and the x-axis.
        sin(180° - θ) = sin θ
        cos(180° - θ) = -cos θ
        sin(360° - θ) = -sin θ
        cos(360° - θ) = cos θ

        Solving triangles: use trig ratios to find unknown sides or angles.
        To find an angle: use the inverse function, e.g. θ = sin⁻¹(0.5) = 30°.

        Applications: angles of elevation (looking up from horizontal),
        angles of depression (looking down from horizontal).
        """,
    },
    {
        "metadata": {"subject": "mathematics", "grade": 10, "topic": "finance",
                     "title": "Financial Mathematics — Simple and Compound Interest — Grade 10 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Financial Mathematics — Grade 10 Mathematics (CAPS)

        Simple Interest: interest calculated only on the original principal.
        Formula: A = P(1 + in)
        A = accumulated amount, P = principal, i = interest rate per year, n = time in years.
        Interest earned = A - P = Pin

        Compound Interest: interest calculated on principal plus previously earned interest.
        Formula: A = P(1 + i)ⁿ
        Interest is compounded annually by default in Grade 10.
        The difference between simple and compound grows significantly over time.

        Example comparison (P = R10 000, i = 10%, n = 5 years):
        Simple: A = 10000(1 + 0.1×5) = R15 000
        Compound: A = 10000(1.1)⁵ ≈ R16 105.10
        Compound growth earns R1 105.10 more.

        Hire Purchase (HP):
        A credit agreement where you pay a deposit + equal monthly instalments.
        Simple interest is always used for HP calculations.
        Total cost = deposit + (monthly instalment × number of months)
        Often more expensive than saving up because of interest charged.

        Currency exchange:
        Exchange rate tells you how many units of one currency = one unit of another.
        If R1 = $0.055, then to convert Rand to Dollars: multiply by 0.055.
        To convert Dollars to Rand: divide by 0.055 (or multiply by the reciprocal).
        South African Rand (ZAR) is the currency. SARB influences its value via interest rates.

        Inflation and real vs nominal values:
        Nominal value = the actual price. Real value adjusts for inflation.
        Real return ≈ nominal return - inflation rate.
        """,
    },
    # ── Grade 11 ──────────────────────────────────────────────────────────
    {
        "metadata": {"subject": "mathematics", "grade": 11, "topic": "sequences_series",
                     "title": "Number Patterns — Arithmetic and Geometric Sequences — Grade 11 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Number Patterns — Grade 11 Mathematics (CAPS)

        Arithmetic Sequence: each term is obtained by adding a constant common difference (d).
        General term: Tₙ = a + (n - 1)d
        a = first term, d = common difference, n = term number.
        Example: 3, 7, 11, 15, ... → a = 3, d = 4, T₅ = 3 + 4×4 = 19.

        Geometric Sequence: each term is obtained by multiplying by a constant common ratio (r).
        General term: Tₙ = arⁿ⁻¹
        a = first term, r = common ratio.
        Example: 2, 6, 18, 54, ... → a = 2, r = 3, T₄ = 2×3³ = 54.

        Quadratic Sequence: second differences are constant.
        General term: Tₙ = an² + bn + c
        First find second differences to confirm it's quadratic.
        Use simultaneous equations with T₁, T₂, T₃ to find a, b, c.

        Sum of an arithmetic series:
        Sₙ = n/2 × (2a + (n-1)d) or Sₙ = n/2 × (a + l) where l = last term.

        Sum of a geometric series:
        Sₙ = a(rⁿ - 1)/(r - 1) for r ≠ 1.
        If |r| < 1, infinite geometric series converges: S∞ = a/(1 - r).

        Sigma notation: Σ means "sum of". ∑ᵢ₌₁ⁿ Tᵢ means sum terms from i=1 to n.
        """,
    },
    {
        "metadata": {"subject": "mathematics", "grade": 11, "topic": "trigonometry",
                     "title": "Trigonometry — Sine Rule, Cosine Rule, Area Rule — Grade 11 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Trigonometry — Sine, Cosine and Area Rules — Grade 11 Mathematics (CAPS)

        Used for non-right-angled triangles. In a triangle with sides a, b, c
        and opposite angles A, B, C:

        Sine Rule: a/sin A = b/sin B = c/sin C
        Use when you know: two angles and one side (AAS or ASA),
        or two sides and a non-included angle (SSA — check for ambiguous case).

        Cosine Rule: a² = b² + c² - 2bc.cos A
        (and similarly for b and c)
        Use when you know: two sides and the included angle (SAS),
        or all three sides (SSS) to find an angle.
        Rearranged to find angle A: cos A = (b² + c² - a²) / (2bc)

        Area Rule: Area = ½ab.sin C
        Use when you know two sides and the included angle.

        Compound angle identities (Grade 11):
        sin(A + B) = sin A cos B + cos A sin B
        sin(A - B) = sin A cos B - cos A sin B
        cos(A + B) = cos A cos B - sin A sin B
        cos(A - B) = cos A cos B + sin A sin B

        Double angle identities:
        sin 2A = 2 sin A cos A
        cos 2A = cos²A - sin²A = 1 - 2sin²A = 2cos²A - 1

        Solving trigonometric equations:
        Find reference angle, apply quadrant rules, add periodicity (+ 360°k for sin/cos,
        + 180°k for tan).
        """,
    },
    {
        "metadata": {"subject": "mathematics", "grade": 11, "topic": "statistics",
                     "title": "Statistics — Variance, Standard Deviation, Regression — Grade 11 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Statistics — Grade 11 Mathematics (CAPS)

        Measures of central tendency: mean (x̄), median, mode.
        Mean = sum of all values / number of values.

        Measures of spread:
        Range = maximum - minimum.
        Interquartile range (IQR) = Q3 - Q1 (middle 50% of data).
        Variance (σ²): average of the squared deviations from the mean.
        σ² = Σ(xᵢ - x̄)² / n
        Standard deviation (σ) = √variance.
        A smaller σ means data is clustered close to the mean.
        A larger σ means data is more spread out.

        Five number summary: minimum, Q1, median (Q2), Q3, maximum.
        Used to draw a box-and-whisker plot.
        Outliers: values more than 1.5 × IQR below Q1 or above Q3.

        Frequency histograms vs bar charts:
        Histograms show continuous data with no gaps between bars.
        Bar charts show categorical data with gaps between bars.

        Ogive (cumulative frequency curve):
        Plots cumulative frequency vs upper class boundary.
        Used to read off median and quartiles.

        Bivariate data (two variables):
        Scatter plot shows relationship between two variables.
        Correlation: positive (both increase), negative (one increases, other decreases),
        or no correlation.
        Line of best fit (least-squares regression line): ŷ = a + bx.
        Correlation coefficient r: ranges from -1 to +1.
        r close to +1 = strong positive; r close to -1 = strong negative; r near 0 = weak.
        """,
    },
    # ── Grade 12 ──────────────────────────────────────────────────────────
    {
        "metadata": {"subject": "mathematics", "grade": 12, "topic": "calculus",
                     "title": "Differential Calculus — Derivatives and Applications — Grade 12 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Differential Calculus — Grade 12 Mathematics (CAPS)

        The derivative f'(x) measures the rate of change of f(x) at any point.
        Geometrically, f'(x) is the gradient of the tangent to the curve at that point.

        Differentiation from first principles:
        f'(x) = lim[h→0] [f(x + h) - f(x)] / h

        Rules of differentiation (standard rules for the exam):
        Power rule: d/dx[xⁿ] = nxⁿ⁻¹
        Constant rule: d/dx[k] = 0
        Sum/difference rule: d/dx[f(x) ± g(x)] = f'(x) ± g'(x)
        Constant multiple: d/dx[kf(x)] = kf'(x)

        Notation: f'(x), dy/dx, Dₓy are all the same thing.

        Finding the equation of a tangent line at x = a:
        1. Find the gradient m = f'(a).
        2. Use point-slope form: y - f(a) = m(x - a).

        Cubic functions f(x) = ax³ + bx² + cx + d:
        Stationary points: solve f'(x) = 0.
        Nature of stationary points: use f''(x) (second derivative).
        f''(a) < 0 → local maximum. f''(a) > 0 → local minimum.
        Point of inflection: where f''(x) = 0 and concavity changes.

        Practical applications:
        Rate of change: velocity = ds/dt (derivative of displacement).
        Acceleration = dv/dt (derivative of velocity).
        Optimisation: find maximum profit, minimum cost, maximum area.
        Set derivative to zero, solve, test with second derivative.

        Cubic sketching steps: find x- and y-intercepts, stationary points,
        point of inflection, then sketch.
        """,
    },
    {
        "metadata": {"subject": "mathematics", "grade": 12, "topic": "finance",
                     "title": "Financial Mathematics — Annuities and Present Value — Grade 12 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Financial Mathematics — Grade 12 Mathematics (CAPS)

        Compound interest (recap): A = P(1 + i)ⁿ
        Effective vs nominal interest rate:
        If compounded monthly at rate i_month, effective annual rate = (1 + i_month)¹² - 1.

        Depreciation:
        Straight-line: A = P(1 - in) — equal reduction each year.
        Reducing balance: A = P(1 - i)ⁿ — percentage reduction on current value.

        Future Value Annuity (saving equal amounts periodically):
        Fv = x[(1 + i)ⁿ - 1] / i
        x = payment per period, i = interest rate per period, n = number of periods.
        Use this to calculate how much a savings plan accumulates.

        Present Value Annuity (loan repayments):
        Pv = x[1 - (1 + i)⁻ⁿ] / i
        Use this to calculate monthly repayments on a home loan or car finance.
        South African context: home loans are typically over 20 years,
        repayments sensitive to repo rate changes from SARB.

        Calculating the balance outstanding:
        Balance = Pv of remaining payments = x[1 - (1 + i)⁻ᵏ] / i
        where k = number of payments still to be made.

        Exam-style problem: A car costs R350 000. A 10% deposit is paid.
        The balance is financed at 14% per year compounded monthly over 5 years.
        Find the monthly repayment.
        i = 0.14/12, n = 60, Pv = 315 000. Solve for x using Pv formula.
        """,
    },
    {
        "metadata": {"subject": "mathematics", "grade": 12, "topic": "probability",
                     "title": "Probability and Counting Principles — Grade 12 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Probability and Counting Principles — Grade 12 Mathematics (CAPS)

        Fundamental counting principle: if event A can occur in m ways and event B
        in n ways, together they can occur in m × n ways.

        Factorial: n! = n × (n-1) × (n-2) × ... × 1. By definition 0! = 1.

        Permutations (order matters):
        nPr = n! / (n - r)! — selecting r items from n in order.
        Arrangements of n items: n! ways.
        With repeated items: n! / (p! × q! × ...) where p, q are repeated counts.
        Circular arrangements: (n - 1)! ways.

        Combinations (order does not matter):
        nCr = n! / [r!(n - r)!] — selecting r items from n, order irrelevant.
        Also written as (n choose r) or C(n,r).

        Probability rules:
        P(A) = number of favourable outcomes / total outcomes (equally likely).
        P(A') = 1 - P(A) (complement).
        P(A or B) = P(A) + P(B) - P(A and B) (addition rule).
        For mutually exclusive events: P(A or B) = P(A) + P(B).
        P(A and B) = P(A) × P(B) for independent events.

        Venn diagrams: show intersection and union of events.
        Tree diagrams: show sequential probability outcomes.
        Contingency tables: two-way tables showing frequencies for two events.
        Test for independence: P(A and B) = P(A) × P(B).
        """,
    },
]

# ---------------------------------------------------------------------------
# PHYSICAL SCIENCES
# ---------------------------------------------------------------------------

PHYSICS: list[dict] = [
    # ── Grade 10 ──────────────────────────────────────────────────────────
    {
        "metadata": {"subject": "physical_sciences", "grade": 10, "topic": "mechanics",
                     "title": "Vectors and Motion — Grade 10 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Vectors and Motion — Grade 10 Physical Sciences (CAPS)

        Scalar: has magnitude only (e.g. speed, distance, mass, temperature).
        Vector: has magnitude AND direction (e.g. velocity, displacement, force, acceleration).

        Distance vs Displacement:
        Distance = total path length (scalar).
        Displacement = straight-line distance from start to end point, with direction (vector).

        Speed vs Velocity:
        Speed = distance / time (scalar).
        Velocity = displacement / time (vector).

        Acceleration: rate of change of velocity. a = Δv / t = (vf - vi) / t
        Units: m·s⁻²

        Equations of motion (uniform acceleration, no air resistance):
        vf = vi + at
        Δx = vit + ½at²
        vf² = vi² + 2aΔx
        Δx = ½(vi + vf)t

        Sign convention: choose positive direction first (usually up or right).
        Objects in free fall have acceleration g = 9.8 m·s⁻² downward.

        Graphs of motion:
        Position-time (x vs t): gradient = velocity. Straight line = constant velocity.
        Velocity-time (v vs t): gradient = acceleration. Area under graph = displacement.
        Acceleration-time (a vs t): area under graph = change in velocity.

        Ticker tape: used to record motion. Dots are equally spaced in time (0.02s apart
        at 50 Hz). Distance between dots shows speed; increasing gaps = acceleration.
        """,
    },
    {
        "metadata": {"subject": "physical_sciences", "grade": 10, "topic": "mechanics",
                     "title": "Newton's Laws of Motion — Grade 10 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Newton's Laws of Motion — Grade 10 Physical Sciences (CAPS)

        Newton's First Law (Law of Inertia):
        An object remains at rest or in uniform motion in a straight line unless
        acted upon by a net external force.
        Inertia = resistance to change in motion. More mass = more inertia.
        Examples: a passenger lurching forward when a car brakes; seatbelts.

        Newton's Second Law:
        The net force on an object equals its mass times its acceleration.
        Fnet = ma (or ΣF = ma)
        Units: Force in Newtons (N = kg·m·s⁻²).
        Direction of acceleration is the same as direction of net force.

        Free body diagrams: show all forces acting on ONE object.
        Common forces: weight (W = mg, downward), normal force (N, perpendicular to surface),
        friction (f, opposing motion), tension (T, along rope/string), applied force (F).

        Newton's Third Law:
        For every action there is an equal and opposite reaction.
        Forces always come in action-reaction pairs acting on DIFFERENT objects.
        Example: foot pushes ground backward (action), ground pushes foot forward (reaction).

        Friction:
        Static friction: acts when object is stationary, prevents motion from starting.
        Kinetic (dynamic) friction: acts when object slides; slightly less than static.
        f = μN where μ = coefficient of friction, N = normal force.

        Equilibrium: when Fnet = 0 — object is stationary or moving at constant velocity.
        For equilibrium: ΣFx = 0 and ΣFy = 0.
        """,
    },
    {
        "metadata": {"subject": "physical_sciences", "grade": 10, "topic": "electricity",
                     "title": "Electric Circuits — Ohm's Law and Series/Parallel — Grade 10 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Electric Circuits — Grade 10 Physical Sciences (CAPS)

        Current (I): flow of charge. Unit: Ampere (A). Measured with ammeter (in series).
        Voltage/Potential Difference (V): energy per unit charge. Unit: Volt (V).
        Measured with voltmeter (in parallel).
        Resistance (R): opposition to current flow. Unit: Ohm (Ω).

        Ohm's Law: V = IR (provided temperature is constant).
        An ohmic conductor obeys Ohm's Law — resistance stays constant.
        A non-ohmic conductor does not (e.g. LED, light bulb at different temperatures).

        Series circuit:
        Components connected end-to-end. Same current through all components.
        Total resistance: R_total = R₁ + R₂ + R₃ + ...
        Voltage divides across components: V_total = V₁ + V₂ + V₃

        Parallel circuit:
        Components connected across same two points. Same voltage across all.
        Total resistance: 1/R_total = 1/R₁ + 1/R₂ + 1/R₃
        Total resistance is LESS than any individual resistance.
        Current divides: I_total = I₁ + I₂ + I₃

        Power: P = IV = I²R = V²/R. Unit: Watt (W).
        Energy: E = Pt = VIt. Unit: Joule (J).
        Electricity cost uses kilowatt-hours (kWh). Relevant to Eskom tariffs in SA.

        Kirchhoff's Voltage Law: sum of EMFs = sum of potential differences in a loop.
        Kirchhoff's Current Law: sum of currents into a junction = sum leaving.

        EMF (electromotive force): energy supplied per coulomb by the cell.
        EMF = terminal voltage + lost voltage (due to internal resistance r).
        ε = V + Ir = I(R + r).
        """,
    },
    {
        "metadata": {"subject": "physical_sciences", "grade": 10, "topic": "chemistry",
                     "title": "Matter, Atoms and the Periodic Table — Grade 10 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Matter, Atoms and the Periodic Table — Grade 10 Physical Sciences (CAPS)

        Matter: anything with mass and volume.
        Pure substance: fixed composition (element or compound).
        Mixture: two or more substances not chemically combined. Can be separated physically.
        Homogeneous mixture: uniform composition throughout (e.g. salt water, air).
        Heterogeneous mixture: non-uniform (e.g. sand in water).

        Atoms:
        Nucleus contains protons (positive) and neutrons (neutral).
        Electrons (negative) orbit in energy levels (shells) around the nucleus.
        Atomic number (Z) = number of protons = number of electrons (neutral atom).
        Mass number (A) = protons + neutrons.
        Isotopes: same element, different number of neutrons.

        The Periodic Table:
        Elements arranged in order of increasing atomic number.
        Periods (rows): elements with same number of electron shells.
        Groups (columns): elements with same number of valence electrons and similar properties.
        Group 1 (alkali metals): highly reactive, one valence electron.
        Group 17 (halogens): highly reactive non-metals, seven valence electrons.
        Group 18 (noble gases): very unreactive, full outer shell.

        Electron configuration: fill shells in order 2, 8, 8, ...
        Valence electrons: electrons in outermost shell. Determine chemical behaviour.

        Ions: atoms that have gained or lost electrons.
        Cation: positive ion (lost electrons). Anion: negative ion (gained electrons).
        Example: Na loses 1 electron → Na⁺. Cl gains 1 electron → Cl⁻.

        Chemical bonding preview:
        Ionic bond: transfer of electrons between metal and non-metal.
        Covalent bond: sharing of electrons between non-metals.
        """,
    },
    # ── Grade 11 ──────────────────────────────────────────────────────────
    {
        "metadata": {"subject": "physical_sciences", "grade": 11, "topic": "mechanics",
                     "title": "Work, Energy and Power — Grade 11 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Work, Energy and Power — Grade 11 Physical Sciences (CAPS)

        Work done by a force:
        W = FΔx cos θ
        F = force, Δx = displacement, θ = angle between force and displacement.
        Unit: Joule (J). Work is a scalar.
        Positive work: force and displacement in same direction (energy transferred to object).
        Negative work: force opposes motion (energy removed from object).

        Work-Energy Theorem: the net work done on an object equals its change in kinetic energy.
        Wnet = ΔEk = ½mvf² - ½mvi²

        Kinetic energy: Ek = ½mv². Unit: Joule.
        Gravitational potential energy: Ep = mgh (h = height above reference point). Unit: Joule.
        Mechanical energy: Em = Ek + Ep.

        Conservation of mechanical energy (no friction):
        Total mechanical energy remains constant.
        Ek₁ + Ep₁ = Ek₂ + Ep₂
        ½mv₁² + mgh₁ = ½mv₂² + mgh₂

        With friction or air resistance:
        Wnet = ΔEk → Ek₂ = Ek₁ + Wnet (work by friction is negative).
        Energy is NOT conserved mechanically — converted to heat.

        Power: rate of doing work. P = W/t = Fv. Unit: Watt (W = J·s⁻¹).
        Average power: P_avg = total work / total time.

        Practical example: a motor lifting bales of hay, a car engine working against friction.
        Eskom sells electrical energy in kWh. 1 kWh = 3 600 000 J.
        """,
    },
    {
        "metadata": {"subject": "physical_sciences", "grade": 11, "topic": "mechanics",
                     "title": "Momentum and Impulse — Grade 11 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Momentum and Impulse — Grade 11 Physical Sciences (CAPS)

        Momentum: p = mv. Unit: kg·m·s⁻¹. Vector — same direction as velocity.

        Newton's Second Law in terms of momentum:
        Fnet = Δp/Δt = m(vf - vi)/Δt

        Impulse: J = FnetΔt = Δp = mvf - mvi
        Impulse equals change in momentum.
        Unit: N·s = kg·m·s⁻¹.
        Increasing contact time (airbags, foam mats) reduces peak force.

        Conservation of Momentum (Law):
        In an isolated system (no external forces), total momentum is conserved.
        p_before = p_after
        m₁v₁ᵢ + m₂v₂ᵢ = m₁v₁f + m₂v₂f

        Types of collisions:
        Elastic collision: momentum AND kinetic energy are both conserved.
        Total Ek before = Total Ek after.
        Inelastic collision: momentum is conserved but kinetic energy is NOT.
        Some kinetic energy is converted to heat, sound, deformation.
        Perfectly inelastic collision: objects stick together after collision.
        Use: m₁v₁ + m₂v₂ = (m₁ + m₂)vf

        Explosion (reverse collision): objects start together and separate.
        Total momentum before = 0 → m₁v₁ = -m₂v₂ (momenta are equal and opposite).

        Sign convention: choose positive direction. Opposite direction is negative.
        Always define positive direction in momentum problems.
        """,
    },
    {
        "metadata": {"subject": "physical_sciences", "grade": 11, "topic": "chemistry",
                     "title": "Chemical Bonding and Molecular Structure — Grade 11 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Chemical Bonding — Grade 11 Physical Sciences (CAPS)

        Ionic bonding: metal transfers electrons to non-metal.
        Metal becomes positive cation; non-metal becomes negative anion.
        Held together by electrostatic attraction. Form crystal lattices.
        Properties: high melting points, conduct electricity when dissolved or molten,
        brittle, solid at room temperature. Examples: NaCl, MgO, CaCl₂.

        Covalent bonding: non-metals share electron pairs.
        Single bond: one shared pair (e.g. H₂, HCl).
        Double bond: two shared pairs (e.g. O₂, CO₂).
        Triple bond: three shared pairs (e.g. N₂).
        Dative/coordinate bond: both electrons from one atom (e.g. NH₃·H⁺).

        Lewis diagrams (dot-and-cross): show valence electrons and bonding pairs.
        Lone pairs: non-bonding pairs of electrons on an atom.

        VSEPR theory (Valence Shell Electron Pair Repulsion):
        Electron pairs repel → determine molecular shape.
        2 bond pairs: linear (180°). e.g. CO₂.
        3 bond pairs: trigonal planar (120°). e.g. BF₃.
        4 bond pairs: tetrahedral (109.5°). e.g. CH₄.
        3 bond pairs + 1 lone pair: pyramidal (~107°). e.g. NH₃.
        2 bond pairs + 2 lone pairs: bent/angular (~104.5°). e.g. H₂O.

        Electronegativity and polarity:
        Electronegativity = ability of an atom to attract electrons in a bond.
        Large difference → polar bond. Equal → non-polar.
        Polar molecule: has net dipole moment (asymmetric shape + polar bonds).
        Non-polar molecule: symmetrical (even if bonds are polar, dipoles cancel).

        Intermolecular forces:
        Ion-dipole, hydrogen bonding, dipole-dipole, London dispersion forces.
        Stronger forces → higher boiling/melting points.
        """,
    },
    # ── Grade 12 ──────────────────────────────────────────────────────────
    {
        "metadata": {"subject": "physical_sciences", "grade": 12, "topic": "mechanics",
                     "title": "Vertical Projectile Motion and Newton's Laws — Grade 12 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Vertical Projectile Motion — Grade 12 Physical Sciences (CAPS)

        An object in free fall (no air resistance) experiences only gravity.
        Acceleration = g = 9.8 m·s⁻² downward (use -9.8 if up is positive).

        Key concept: at the highest point of a projectile's path, velocity = 0
        but acceleration is still g downward.

        Going up: vi > 0 (if up is positive), a = -9.8 m·s⁻², object decelerates.
        Coming down: velocity becomes more negative, speed increases.

        Using equations of motion with sign convention:
        Choose up as positive. g = -9.8 m·s⁻².
        vf = vi + at
        Δy = vit + ½at²
        vf² = vi² + 2aΔy

        An object thrown upward and returning to same height:
        Time going up = time coming down. Speed at same height is equal.
        This follows from symmetry and conservation of energy.

        Graphs:
        Position-time: parabola (opening downward if only gravity acts upward throw).
        Velocity-time: straight line (constant gradient = -9.8 m·s⁻²).
        Acceleration-time: horizontal line at -9.8 m·s⁻² throughout.

        Multi-body problems (strings over pulleys):
        Apply Newton's Second Law to each body separately.
        For system: Fnet_system = (m₁ + m₂)a if connected.
        Tension is internal to the system.

        Impulse-momentum with variable forces: use the area under an F-t graph.
        """,
    },
    {
        "metadata": {"subject": "physical_sciences", "grade": 12, "topic": "electricity",
                     "title": "Electric Circuits with Internal Resistance — Grade 12 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Electric Circuits with Internal Resistance — Grade 12 Physical Sciences (CAPS)

        Every real cell has internal resistance (r) in addition to its EMF (ε).
        When current flows, some voltage is lost across internal resistance.

        EMF equation: ε = V_terminal + V_lost = IR + Ir = I(R + r)
        V_terminal (terminal potential difference) = ε - Ir
        When no current flows (open circuit): V_terminal = ε.
        As current increases, terminal voltage drops.

        Lost voltage (V_lost) = Ir — this is the energy wasted inside the cell.

        Graphical method to find ε and r:
        Plot V_terminal vs I. The graph is linear.
        y-intercept = ε. Gradient (negative) = -r.

        Series-parallel circuits with internal resistance:
        Treat external circuit normally (find R_external).
        Then use: I_total = ε / (R_external + r)
        Find V_terminal = I_total × R_external.
        Distribute current/voltage within the external circuit as usual.

        Power dissipated internally: P_internal = I²r (wasted as heat in cell).
        Power delivered to external circuit: P_external = I²R.
        Total power: P_total = εI.
        Efficiency = P_external / P_total = R/(R + r).

        Practical: a flat battery has high internal resistance. Terminal voltage drops
        significantly under load even though EMF may still be close to normal.
        This is why a car battery can show correct voltage on a multimeter but still
        fail to start the engine (high current needed exposes the high r).
        """,
    },
    {
        "metadata": {"subject": "physical_sciences", "grade": 12, "topic": "chemistry",
                     "title": "Acids and Bases — Grade 12 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Acids and Bases — Grade 12 Physical Sciences (CAPS)

        Arrhenius definition:
        Acid: produces H⁺ ions in water. Base: produces OH⁻ ions in water.

        Brønsted-Lowry definition (more general):
        Acid: proton (H⁺) donor. Base: proton acceptor.
        Conjugate acid-base pairs: differ by one H⁺.

        Strong vs weak acids:
        Strong acid: fully ionises in water (e.g. HCl, H₂SO₄, HNO₃).
        Weak acid: partially ionises — equilibrium established (e.g. CH₃COOH, H₂CO₃).

        pH scale: pH = -log[H₃O⁺]
        pH < 7: acidic. pH = 7: neutral. pH > 7: basic (alkaline).
        pOH = -log[OH⁻]. pH + pOH = 14 (at 25°C).
        Strong acid 0.1 mol·dm⁻³ HCl: [H⁺] = 0.1 mol·dm⁻³, pH = 1.

        Neutralisation: acid + base → salt + water.
        H⁺(aq) + OH⁻(aq) → H₂O(l)
        Net ionic equation removes spectator ions.

        Titrations:
        Determine concentration of unknown acid/base using known concentration.
        Equivalence point: moles of acid = moles of base (adjusted for stoichiometry).
        Indicator changes colour near equivalence point.
        n = c × V (n = moles, c = concentration in mol·dm⁻³, V = volume in dm³).

        Hydrolysis of salts:
        Salt of strong acid + strong base → neutral solution.
        Salt of weak acid + strong base → basic solution.
        Salt of strong acid + weak base → acidic solution.

        Kw = [H₃O⁺][OH⁻] = 1×10⁻¹⁴ at 25°C.
        """,
    },
]

# ---------------------------------------------------------------------------
# ECONOMICS — Grade 11 & 12
# ---------------------------------------------------------------------------

ECONOMICS_G11_G12: list[dict] = [
    # ── Grade 11 ──────────────────────────────────────────────────────────
    {
        "metadata": {"subject": "economics", "grade": 11, "topic": "microeconomics",
                     "title": "Market Structures — Perfect Competition and Monopoly — Grade 11 Economics",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Market Structures — Grade 11 Economics (CAPS)

        Perfect Competition:
        Many buyers and sellers. Homogeneous (identical) products.
        No single firm can influence price — all firms are price takers.
        Free entry and exit of firms in the long run.
        Perfect information for all market participants.
        Profit-maximising rule: produce where MR = MC (marginal revenue = marginal cost).
        In the long run: firms earn only normal profit (economic profit = 0).
        South African grain and livestock markets approximate perfect competition.

        Monopoly:
        One firm controls the entire market. No close substitutes.
        High barriers to entry (legal, capital, natural).
        Firm is a price maker — faces downward-sloping demand curve.
        MR < Price for a monopolist (must lower price to sell more, affecting all units).
        Profit maximised where MR = MC, but price is read from demand curve above MC.
        Produces less and charges more than perfectly competitive equivalent.
        Example: Eskom (electricity generation in SA) has natural monopoly characteristics.

        Monopolistic Competition:
        Many firms with differentiated (similar but not identical) products.
        Some price-making power due to brand/product differences.
        Free entry and exit in long run → normal profit in long run.
        Advertising and non-price competition are important.
        Examples: restaurants, clothing retailers in South Africa.

        Oligopoly:
        Few dominant firms. High barriers to entry.
        Firms are interdependent — each firm considers rivals' reactions.
        Collusion (price-fixing) is illegal in SA under the Competition Act.
        Competition Commission investigates and penalises cartels.
        Examples: South African banking sector (ABSA, FNB, Standard Bank, Nedbank).
        """,
    },
    {
        "metadata": {"subject": "economics", "grade": 11, "topic": "macroeconomics",
                     "title": "Labour Market and Unemployment — Grade 11 Economics",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Labour Market and Unemployment — Grade 11 Economics (CAPS)

        Labour: the human effort (physical and mental) used in production.
        Demand for labour is a derived demand — firms hire workers to produce goods.

        Wage determination:
        In a competitive labour market, wage = intersection of labour demand and supply.
        Minimum wage: a legally set floor above equilibrium wage. Increases unemployment
        if set too high (quantity supplied of labour exceeds quantity demanded).
        South Africa introduced the National Minimum Wage (NMW) in 2019.

        Types of unemployment:
        Cyclical (demand-deficient): caused by recession — insufficient aggregate demand.
        Structural: caused by mismatch between skills and available jobs (technology change).
        Frictional: temporary unemployment between jobs; searching for better match.
        Seasonal: caused by seasonal demand fluctuations (agriculture, tourism in SA).
        Disguised: people appear employed but contribute little (overstaffed government).

        South Africa's unemployment challenge:
        Official unemployment rate ~33% using narrow definition (2020s figures).
        Expanded unemployment (includes discouraged work-seekers): ~45%.
        Youth unemployment (15–34) exceeds 60% — a critical structural problem.
        Causes: skills mismatch from poor education, labour market rigidities,
        low economic growth, legacy of apartheid spatial planning.

        NEDLAC (National Economic Development and Labour Council):
        Forum for government, business, labour and community to negotiate labour policy.
        Labour Relations Act and CCMA (Commission for Conciliation, Mediation and Arbitration)
        govern dispute resolution in SA.
        """,
    },
    {
        "metadata": {"subject": "economics", "grade": 11, "topic": "macroeconomics",
                     "title": "Monetary Policy — SARB and Interest Rates — Grade 11 Economics",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Monetary Policy — Grade 11 Economics (CAPS)

        Monetary policy: actions by the South African Reserve Bank (SARB) to control the
        money supply and interest rates to achieve economic stability.

        The SARB's primary mandate is price stability — keeping inflation within the
        3–6% target band. It also supports sustainable economic growth.

        The Monetary Policy Committee (MPC):
        Meets every two months to set the repo rate.
        Repo rate: the rate at which the SARB lends money to commercial banks.
        Banks then lend to the public at the prime rate (repo + 3.5 percentage points).

        Expansionary monetary policy (loose policy):
        SARB cuts the repo rate → cheaper borrowing for banks → lower prime rate →
        households and businesses borrow more → spending and investment increase →
        economic growth stimulated but inflation risk rises.

        Contractionary monetary policy (tight policy):
        SARB raises the repo rate → borrowing becomes expensive → spending falls →
        inflationary pressure reduced → but economic growth may slow.

        Transmission mechanism: repo rate changes take 12–18 months to fully impact the economy.

        Quantitative easing: central bank buys assets to inject money into the economy.
        Used during crises (e.g. SARB interventions during COVID-19).

        Money supply measures:
        M1: notes, coins, and demand deposits.
        M2: M1 + short-term savings deposits.
        M3: M2 + long-term deposits. SARB monitors M3 as a broad money supply indicator.

        Exchange rate link: higher interest rates attract foreign capital → Rand strengthens.
        Weaker Rand makes imports more expensive → imported inflation in South Africa.
        """,
    },
    {
        "metadata": {"subject": "economics", "grade": 11, "topic": "macroeconomics",
                     "title": "Fiscal Policy — Government Budget and Spending — Grade 11 Economics",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Fiscal Policy — Grade 11 Economics (CAPS)

        Fiscal policy: government use of taxation and spending to influence the economy.
        Managed by the National Treasury. Presented annually in the Budget Speech
        (usually February) by the Minister of Finance.

        Government revenue sources:
        Personal income tax (largest source in SA).
        Corporate income tax. Value-Added Tax (VAT) at 15%.
        Customs and excise duties. Capital gains tax.

        Government expenditure:
        Social spending (education, health, social grants — SASSA).
        Infrastructure investment (transport, energy, water).
        Public service wages. Debt service costs (interest on government debt).

        Budget balance positions:
        Budget surplus: revenue > spending → government saves or reduces debt.
        Balanced budget: revenue = spending.
        Budget deficit: spending > revenue → government must borrow to cover the gap.

        South Africa's fiscal position:
        SA has run persistent budget deficits for over a decade.
        Government borrows by issuing bonds. Growing debt service costs crowd out spending.
        Debt-to-GDP ratio is a measure of fiscal sustainability.
        National Treasury targets fiscal consolidation to stabilise debt.

        Expansionary fiscal policy:
        Increase government spending or cut taxes → stimulate aggregate demand.
        Multiplier effect: initial spending increase leads to larger GDP increase.

        Contractionary fiscal policy:
        Cut spending or raise taxes → reduce inflationary pressure or budget deficit.
        Austerity: painful for growth but necessary when debt is unsustainable.
        """,
    },
    # ── Grade 12 ──────────────────────────────────────────────────────────
    {
        "metadata": {"subject": "economics", "grade": 12, "topic": "macroeconomics",
                     "title": "Economic Growth and Development — Grade 12 Economics",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Economic Growth and Development — Grade 12 Economics (CAPS)

        Economic Growth: increase in real GDP over time. Measured as % annual change.
        Factors of production driving growth: land, labour, capital, entrepreneurship.
        Growth requires investment in physical capital (machinery) and human capital (education).

        Economic Development: broader concept — improvement in living standards, reduction
        of poverty, better health and education, more equal distribution of income.
        Growth is necessary but not sufficient for development.

        Key development indicators:
        GDP per capita: average income per person.
        Human Development Index (HDI): combines life expectancy, education, and income.
        Gini Coefficient: measures income inequality (0 = perfect equality, 1 = perfect inequality).
        SA has one of the world's highest Gini coefficients (~0.63).

        Poverty in South Africa:
        Upper-bound poverty line set by Stats SA (~R1 558 per person per month in 2023).
        Over 55% of South Africans live below this line.
        Social grants (child support, old age pension, disability) via SASSA are critical.
        SRD (Social Relief of Distress) grant introduced during COVID-19.

        Causes of underdevelopment in South Africa:
        Legacy of apartheid — spatial, economic, and educational inequality.
        High unemployment (structural and cyclical).
        Infrastructure bottlenecks: electricity (load shedding), logistics (Transnet).
        Skills shortage and weak basic education outcomes (low PISA scores).
        Corruption and governance failures.

        National Development Plan (NDP) 2030:
        South Africa's long-term development blueprint.
        Goals: reduce unemployment to 6%, eliminate extreme poverty, reduce Gini to 0.60.
        Key strategies: industrialisation, infrastructure investment, improved education.
        """,
    },
    {
        "metadata": {"subject": "economics", "grade": 12, "topic": "macroeconomics",
                     "title": "International Trade and Foreign Exchange — Grade 12 Economics",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        International Trade and Foreign Exchange — Grade 12 Economics (CAPS)

        Reasons for international trade:
        Absolute advantage: a country produces a good more efficiently than another.
        Comparative advantage: produce the good with the lowest opportunity cost.
        Trade allows specialisation → higher total output → mutual gains.

        South Africa's main exports: minerals (platinum, gold, iron ore, coal),
        vehicles and vehicle parts, citrus, wine, wool.
        Main imports: machinery, petroleum products, electronics, chemicals.
        Top trading partners: China, USA, Germany, UK, Japan.

        Balance of Payments (BoP):
        Records all economic transactions between SA and the rest of the world.

        Current Account:
        Trade balance (exports - imports of goods and services).
        Income (wages, investment income).
        Current transfers (foreign aid, remittances).
        SA frequently runs a current account deficit.

        Capital and Financial Account:
        Foreign direct investment (FDI): building factories, businesses in SA.
        Portfolio investment: buying SA shares and bonds.
        Reserve assets: changes in SARB's foreign exchange reserves.

        Foreign Exchange (Forex):
        Exchange rate: price of one currency in terms of another.
        Rand (ZAR) is determined by supply and demand in forex markets.
        Factors weakening the Rand: current account deficit, political uncertainty,
        load shedding, rising inflation, global risk aversion.

        Protectionism vs Free Trade:
        Tariffs: tax on imports. Quotas: limit on import quantity.
        Arguments for protection: infant industry, strategic industries, employment.
        Arguments for free trade: efficiency, lower prices, innovation.
        SADC, BRICS, and the African Continental Free Trade Area (AfCFTA) are
        key trade agreements for South Africa.
        """,
    },
    {
        "metadata": {"subject": "economics", "grade": 12, "topic": "microeconomics",
                     "title": "Industrial Policy and Public Sector Economics — Grade 12 Economics",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Industrial Policy and Public Sector — Grade 12 Economics (CAPS)

        Industrial policy: government strategy to develop specific industries or sectors.
        Aims to promote economic growth, create jobs, diversify the economy.

        South Africa's Industrial Policy Action Plan (IPAP):
        Focuses on labour-intensive manufacturing sectors.
        Special Economic Zones (SEZs): designated areas with incentives for investment.
        Black Industrialists Programme: promotes black ownership in industry.
        Broad-Based Black Economic Empowerment (B-BBEE): policy to address historical
        inequality by transforming ownership, management, and employment.

        State-Owned Enterprises (SOEs):
        Government-owned businesses providing strategic services.
        Eskom (electricity), Transnet (freight rail and ports), South African Airways (SAA),
        South African Post Office (SAPO), Denel (defence).
        Challenges: poor governance, debt, load shedding (Eskom), logistics failures (Transnet).
        Government bailouts of SOEs are a major fiscal concern.

        Competition policy:
        Competition Act protects consumers and markets from anti-competitive behaviour.
        Competition Commission investigates mergers and cartel activity.
        Price-fixing, market allocation, and bid-rigging are prohibited.
        Notable cases: bread cartel (2010), construction cartel.

        Public goods vs private goods:
        Public goods: non-excludable (cannot stop others using) and non-rival (one person's
        use does not reduce availability). Examples: street lights, national defence.
        Market failure: public goods are under-provided by markets → government must provide.
        Externalities: costs or benefits spilling over to third parties. Pollution = negative externality.
        Carbon tax in South Africa: charges firms for carbon emissions to internalise external costs.
        """,
    },
]

# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

ALL_SUBJECTS = {
    "maths": MATHS,
    "physics": PHYSICS,
    "economics": ECONOMICS_G11_G12,
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--subject", choices=list(ALL_SUBJECTS.keys()), default=None)
    parser.add_argument("--grade", type=int, default=None)
    args = parser.parse_args()

    env_source = _load_env()
    print(f"Loaded env from: {env_source}")

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://iplliihtphnhgxqmxxdo.supabase.co").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not key:
        print(
            "ERROR: SUPABASE_SERVICE_ROLE_KEY is required.\n"
            "Add it to apps/web/.env.local"
        )
        sys.exit(1)

    supabase = create_client(url, key)
    model = SentenceTransformer("all-MiniLM-L6-v2", device="cuda")
    print(f"Model device: {model.device}\n")

    subjects = (
        {args.subject: ALL_SUBJECTS[args.subject]}
        if args.subject
        else ALL_SUBJECTS
    )

    total = 0
    for subject_name, docs in subjects.items():
        if args.grade:
            docs = [d for d in docs if d["metadata"].get("grade") == args.grade]
        print(f"── {subject_name.upper()} ({len(docs)} documents) ──")
        for doc in docs:
            total += ingest(supabase, model, doc["content"], doc["metadata"])

    print(f"\nDone — {total} total chunks inserted ✅")


if __name__ == "__main__":
    main()
