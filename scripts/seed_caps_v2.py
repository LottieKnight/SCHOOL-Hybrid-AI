"""
SCHOOL CAPS Seed — Extended content batch (v2)
Fills gaps left by seed_caps.py across Mathematics, Physical Sciences, Economics.

Usage (from repo root):
  source ~/gpu-env/bin/activate
  python scripts/seed_caps_v2.py
"""
from __future__ import annotations

import os
import sys

from sentence_transformers import SentenceTransformer
from supabase import create_client

from scripts.ingest import _load_env, ingest


# ---------------------------------------------------------------------------
# MATHEMATICS — additional topics
# ---------------------------------------------------------------------------

MATHS_V2: list[dict] = [
    {
        "metadata": {"subject": "mathematics", "grade": 10, "topic": "geometry",
                     "title": "Euclidean Geometry — Triangles and Similarity — Grade 10 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Euclidean Geometry — Grade 10 Mathematics (CAPS)

        Types of triangles:
        Equilateral: all three sides equal, all angles 60°.
        Isosceles: two sides equal, base angles equal.
        Scalene: no sides equal, no angles equal.
        Right-angled: one angle = 90°.

        Angle sum of a triangle = 180°.
        Exterior angle of a triangle = sum of the two non-adjacent interior angles.

        Congruent triangles (≅): same shape and size. Four conditions:
        SSS: three sides equal.
        SAS: two sides and the included angle equal.
        AAS: two angles and a corresponding side equal.
        RHS: right angle, hypotenuse, and one side equal (right-angled triangles only).

        Similar triangles (|||): same shape, different size. All angles equal,
        sides in proportion. Three conditions:
        AAA: all angles equal (AA is sufficient since angles sum to 180°).
        SSS: all sides in the same ratio.
        SAS: two sides in proportion and the included angle equal.

        Properties of quadrilaterals:
        Parallelogram: opposite sides parallel and equal, opposite angles equal,
        diagonals bisect each other.
        Rectangle: parallelogram with all angles 90°. Diagonals equal.
        Rhombus: parallelogram with all sides equal. Diagonals bisect at 90°.
        Square: rectangle and rhombus combined.
        Trapezium: one pair of parallel sides.
        Kite: two pairs of adjacent sides equal.

        Mid-point theorem: the line segment joining the mid-points of two sides of a
        triangle is parallel to the third side and half its length.

        Pythagoras theorem: In a right-angled triangle, a² + b² = c²
        where c is the hypotenuse. Converse: if a² + b² = c², the triangle is right-angled.
        """,
    },
    {
        "metadata": {"subject": "mathematics", "grade": 10, "topic": "analytical_geometry",
                     "title": "Analytical Geometry — Distance, Midpoint, Gradient — Grade 10 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Analytical Geometry — Grade 10 Mathematics (CAPS)

        Works with geometry on the Cartesian plane using coordinates.

        Distance formula: d = √[(x₂ - x₁)² + (y₂ - y₁)²]
        Finds the length of a line segment between two points.

        Midpoint formula: M = ((x₁ + x₂)/2 , (y₁ + y₂)/2)
        Finds the point exactly halfway between two points.

        Gradient (slope): m = (y₂ - y₁)/(x₂ - x₁)
        Positive gradient: line rises left to right.
        Negative gradient: line falls left to right.
        Zero gradient: horizontal line.
        Undefined gradient: vertical line.

        Parallel lines: same gradient (m₁ = m₂).
        Perpendicular lines: product of gradients = -1 (m₁ × m₂ = -1).

        Equation of a straight line:
        Gradient-intercept form: y = mx + c
        Point-gradient form: y - y₁ = m(x - x₁)

        Collinear points: three points lie on the same line if the gradient
        between any two pairs is equal.

        Quadrilaterals on the Cartesian plane:
        Use distance and gradient formulas to prove a quadrilateral is a parallelogram
        (opposite sides parallel and equal), rectangle (angles 90°), rhombus
        (all sides equal), etc.

        Inclination angle (θ): the angle a line makes with the positive x-axis.
        m = tan θ. For a line rising to the right, 0° < θ < 90°.
        For a line falling to the right, 90° < θ < 180°.
        """,
    },
    {
        "metadata": {"subject": "mathematics", "grade": 11, "topic": "analytical_geometry",
                     "title": "Analytical Geometry — Circles and Tangent Lines — Grade 11 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Analytical Geometry — Grade 11 Mathematics (CAPS)

        Equation of a circle centred at the origin: x² + y² = r²
        Equation of a circle centred at (a; b): (x - a)² + (y - b)² = r²

        Finding the centre and radius from the general form:
        Complete the square for x and y terms to write in standard form.
        x² + y² + Dx + Ey + F = 0
        Group x terms: (x + D/2)² - (D/2)²
        Group y terms: (y + E/2)² - (E/2)²
        Centre = (-D/2 ; -E/2), r = √((D/2)² + (E/2)² - F)

        Tangent to a circle:
        A tangent touches the circle at exactly one point and is perpendicular
        to the radius at that point.
        To find the tangent at point P(x₁; y₁) on circle x² + y² = r²:
        Gradient of radius OP = y₁/x₁
        Gradient of tangent = -x₁/y₁ (negative reciprocal)
        Equation of tangent: y - y₁ = m_tangent(x - x₁)
        Or equivalently: xx₁ + yy₁ = r²

        Intersection of a line and a circle:
        Substitute the line equation into the circle equation.
        Solve the resulting quadratic.
        Discriminant Δ > 0: two intersection points.
        Δ = 0: line is a tangent (one point).
        Δ < 0: line does not intersect the circle.

        Key skill: determine whether a given point lies inside, on, or outside a circle
        by comparing its distance from the centre with the radius.
        """,
    },
    {
        "metadata": {"subject": "mathematics", "grade": 11, "topic": "finance",
                     "title": "Financial Mathematics — Depreciation and Growth — Grade 11 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Financial Mathematics — Grade 11 Mathematics (CAPS)

        Growth (compound interest review): A = P(1 + i)ⁿ
        Used when value increases over time — savings, investments.

        Decay (depreciation): assets lose value over time.

        Straight-line depreciation:
        A = P(1 - in)
        Value decreases by the same fixed amount each period.
        i = depreciation rate per year, n = years.
        Example: Vehicle worth R200 000 depreciated at 15% p.a. straight-line.
        After 5 years: A = 200 000(1 - 0.15×5) = R50 000.

        Reducing balance depreciation (compound decay):
        A = P(1 - i)ⁿ
        Value decreases by a percentage of the current value each period.
        Example: Vehicle worth R200 000 at 15% p.a. reducing balance.
        After 5 years: A = 200 000(1 - 0.15)⁵ ≈ R88 235.

        Reducing balance produces higher book value than straight-line for same rate.

        Effective and nominal interest rates:
        Nominal rate (i_nom): stated annual rate.
        Effective annual rate (EAR): actual rate when compounding more than once per year.
        EAR = (1 + i_nom/m)ᵐ - 1, where m = compounding periods per year.
        Monthly compounding (m=12), quarterly (m=4), semi-annual (m=2).

        Population growth: P = P₀(1 + r)ⁿ — same formula as compound interest.
        Used for city population projections relevant to South Africa's urbanisation.

        Exchange rates and compound interest combined:
        If R1 000 000 is invested in USD at 6% p.a. and the rand weakens,
        the rand value of the investment grows from both interest AND exchange rate movement.
        """,
    },
    {
        "metadata": {"subject": "mathematics", "grade": 12, "topic": "sequences_series",
                     "title": "Sequences and Series — Arithmetic and Geometric Sums — Grade 12 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Sequences and Series — Grade 12 Mathematics (CAPS)

        Arithmetic sequence: Tₙ = a + (n - 1)d
        Sum of arithmetic series: Sₙ = n/2(2a + (n-1)d) = n/2(a + l)
        where l = last term = a + (n-1)d.

        Geometric sequence: Tₙ = arⁿ⁻¹
        Sum of geometric series: Sₙ = a(rⁿ - 1)/(r - 1) for r ≠ 1
        Equivalently: Sₙ = a(1 - rⁿ)/(1 - r) — same formula, different form.

        Infinite geometric series (converges only when |r| < 1):
        S∞ = a/(1 - r)
        If |r| ≥ 1, the series diverges (no finite sum).

        Sigma notation: ∑ᵢ₌ₘⁿ Tᵢ means "sum terms from i = m to i = n".
        ∑ᵢ₌₁ⁿ i = n(n+1)/2 (sum of first n natural numbers)
        ∑ᵢ₌₁ⁿ i² = n(n+1)(2n+1)/6

        Proofs by induction or direct summation are sometimes required.

        Mixed sequences: some sequences change from arithmetic to geometric
        partway through — identify the pattern before applying formulas.

        Practical application — savings with regular deposits (annuity preview):
        Depositing R500 per month at 9% p.a. compounded monthly.
        Each deposit earns compound interest for a different number of months.
        Total = sum of a geometric series where a = 500, r = (1 + 0.09/12).
        This connects directly to the future value annuity formula in Grade 12 finance.

        Finding the number of terms:
        Given Sₙ = some value, solve for n — often requires logarithms.
        log rule: if aⁿ = b, then n = log b / log a.
        """,
    },
    {
        "metadata": {"subject": "mathematics", "grade": 12, "topic": "geometry",
                     "title": "Euclidean Geometry — Circle Theorems and Proofs — Grade 12 Maths",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Euclidean Geometry — Circle Theorems — Grade 12 Mathematics (CAPS)

        These theorems must be known and proven for Grade 12 exams.

        Theorem 1: The line drawn from the centre of a circle perpendicular to a
        chord bisects the chord. (Converse also true.)

        Theorem 2: The angle subtended by an arc at the centre is double the angle
        subtended by the same arc at the circumference.
        Written: ∠AOB = 2 × ∠ACB (O = centre, A,B on circle, C on major arc).

        Theorem 3: Angles in the same segment are equal.
        Angles subtended by the same chord on the same side of the chord are equal.

        Theorem 4: The angle subtended by a diameter at the circumference is 90°
        (angle in a semi-circle).

        Theorem 5: Opposite angles of a cyclic quadrilateral are supplementary
        (add up to 180°).

        Theorem 6: Two tangents drawn from an external point are equal in length.
        The line from the external point to the centre bisects the angle between the tangents.

        Theorem 7: The angle between a tangent and a chord equals the inscribed angle
        on the opposite side of the chord (tan-chord angle = angle in alternate segment).

        Theorem 8: A tangent is perpendicular to the radius at the point of tangency.

        Exam approach for geometry proofs:
        1. Identify what you need to prove.
        2. State all relevant angles with reasons in brackets.
        3. Link statements to reach the conclusion.
        Always write the theorem name or reason in brackets after each statement.
        Example reason format: (∠s in same seg), (opp ∠s of cyclic quad), (tan ⊥ radius).
        """,
    },
]

# ---------------------------------------------------------------------------
# PHYSICAL SCIENCES — additional topics
# ---------------------------------------------------------------------------

PHYSICS_V2: list[dict] = [
    {
        "metadata": {"subject": "physical_sciences", "grade": 10, "topic": "waves",
                     "title": "Waves, Sound and Light — Grade 10 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Waves, Sound and Light — Grade 10 Physical Sciences (CAPS)

        A wave is a disturbance that transfers energy without transferring matter.

        Transverse waves: particles vibrate perpendicular to the direction of wave travel.
        Examples: light, water waves, electromagnetic waves.
        Parts: crest (highest point), trough (lowest point), amplitude (max displacement),
        wavelength λ (distance between two successive crests), period T.

        Longitudinal waves: particles vibrate parallel to the direction of wave travel.
        Example: sound waves. Consist of compressions (high pressure) and rarefactions
        (low pressure).

        Key wave equations:
        Speed v = fλ (frequency × wavelength). Unit: m·s⁻¹.
        Period T = 1/f. Unit: seconds. Frequency f = 1/T. Unit: Hertz (Hz).

        Sound:
        Sound is a longitudinal wave that requires a medium to travel through.
        Cannot travel in a vacuum.
        Speed of sound in air ≈ 340 m·s⁻¹ (varies with temperature).
        Pitch: related to frequency — high pitch = high frequency.
        Loudness: related to amplitude — louder = larger amplitude.
        Echoes: reflection of sound waves.

        Electromagnetic spectrum (transverse waves, travel at 3×10⁸ m·s⁻¹ in vacuum):
        Radio waves → microwaves → infrared → visible light → ultraviolet → X-rays → gamma rays.
        Increasing frequency and energy from left to right.
        Decreasing wavelength from left to right.
        All travel at the speed of light (c = 3×10⁸ m·s⁻¹) in a vacuum.

        Light: travels in straight lines. Reflection: angle of incidence = angle of reflection.
        Refraction: bending of light as it passes from one medium to another (changes speed).
        Snell's law: n₁sinθ₁ = n₂sinθ₂.
        Total internal reflection: occurs when light travels from dense to less dense medium
        above the critical angle. Basis of optical fibre communication.
        """,
    },
    {
        "metadata": {"subject": "physical_sciences", "grade": 11, "topic": "electricity",
                     "title": "Electrostatics — Coulomb's Law and Electric Fields — Grade 11 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Electrostatics — Grade 11 Physical Sciences (CAPS)

        Electric charge: property of matter. Two types: positive (+) and negative (-).
        Like charges repel. Opposite charges attract.
        Charge is measured in Coulombs (C).
        Elementary charge: e = 1.6 × 10⁻¹⁹ C (charge of one proton or electron).

        Conservation of charge: charge cannot be created or destroyed, only transferred.
        Methods of charging: friction (rubbing), conduction (contact), induction (without contact).
        Earthing (grounding): connecting to earth removes excess charge.

        Coulomb's Law:
        The electrostatic force between two point charges is directly proportional to the
        product of the charges and inversely proportional to the square of the distance.
        F = kq₁q₂/r²
        k = 9 × 10⁹ N·m²·C⁻² (Coulomb's constant)
        q₁, q₂ = charges in Coulombs. r = distance between charges in metres.
        F is attractive if charges are opposite, repulsive if same sign.

        Electric field (E): region around a charged object where another charge experiences
        a force. E = F/q (force per unit positive test charge). Unit: N·C⁻¹.
        For a point charge: E = kQ/r²
        Electric field lines: show direction of force on positive test charge.
        Lines go FROM positive TO negative charge.
        Closer lines = stronger field. Lines never cross.

        Electric potential energy and work:
        W = qEd = qΔV where ΔV = potential difference (Voltage).
        Potential difference V = W/q. Unit: Volt (V = J·C⁻¹).

        Capacitors: store electrical energy. Capacitance C = Q/V. Unit: Farad (F).
        Parallel plate capacitor: C = ε₀A/d (area A, plate separation d).
        Energy stored: E = ½QV = ½CV².
        """,
    },
    {
        "metadata": {"subject": "physical_sciences", "grade": 11, "topic": "waves",
                     "title": "Doppler Effect and Sound — Grade 11 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Doppler Effect — Grade 11 Physical Sciences (CAPS)

        The Doppler effect is the change in observed frequency of a wave when
        the source and observer are moving relative to each other.

        When source moves TOWARD observer: waves are compressed → higher frequency
        (higher pitch for sound, blue shift for light).
        When source moves AWAY from observer: waves are stretched → lower frequency
        (lower pitch for sound, red shift for light).

        Doppler equation:
        f_L = f_s × (v ± v_L)/(v ∓ v_s)

        Where:
        f_L = frequency heard by the listener
        f_s = frequency emitted by the source
        v = speed of the wave in the medium (340 m·s⁻¹ for sound in air)
        v_L = speed of the listener
        v_s = speed of the source

        Sign convention:
        Numerator: + if listener moves toward source, - if moving away.
        Denominator: - if source moves toward listener, + if moving away.

        Applications of the Doppler effect:
        Radar speed guns: police measure car speed using reflected radio waves.
        Medical ultrasound: measure blood flow velocity (cardiac ultrasound).
        Astronomy: red shift of galaxies confirms universe is expanding.
        Weather radar: detect movement of rain and storm systems.
        South African context: traffic enforcement on N1 and N3 highways uses Doppler radar.

        Red shift and the expanding universe:
        Distant galaxies show red-shifted light → moving away from us.
        Greater the red shift, the faster and further the galaxy → Hubble's Law.
        """,
    },
    {
        "metadata": {"subject": "physical_sciences", "grade": 12, "topic": "chemistry",
                     "title": "Organic Chemistry — Hydrocarbons and Functional Groups — Grade 12 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Organic Chemistry — Grade 12 Physical Sciences (CAPS)

        Organic chemistry is the study of carbon-containing compounds.
        Carbon forms 4 covalent bonds, allowing long chains and rings.

        Hydrocarbons: contain only C and H atoms.
        Alkanes: single bonds only. General formula CₙH₂ₙ₊₂.
        Methane (CH₄), ethane (C₂H₆), propane (C₃H₈), butane (C₄H₁₀).
        Suffix: -ane. Saturated (no double bonds).

        Alkenes: one or more double bonds. General formula CₙH₂ₙ.
        Ethene (C₂H₄), propene (C₃H₆). Suffix: -ene.
        Unsaturated — can undergo addition reactions.

        Alkynes: triple bond. General formula CₙH₂ₙ₋₂. Suffix: -yne.

        Functional groups (determine chemical behaviour):
        Haloalkanes: -X (halogen). e.g. chloromethane CH₃Cl.
        Alcohols: -OH hydroxyl group. Suffix: -ol. Ethanol C₂H₅OH.
        Carboxylic acids: -COOH. Suffix: -oic acid. Ethanoic acid (vinegar) CH₃COOH.
        Esters: -COO-. Suffix: -oate. Formed from acid + alcohol.
        Aldehydes: -CHO. Suffix: -al.
        Ketones: C=O in chain. Suffix: -one.
        Amines: -NH₂. Basic compounds.

        IUPAC naming rules:
        1. Find longest carbon chain → gives prefix (meth=1, eth=2, prop=3, but=4, pent=5).
        2. Identify and name functional group → gives suffix.
        3. Number chain from end closest to functional group.
        4. Name substituents (branches) with their position number.

        Isomers: same molecular formula, different structural formula.
        Chain isomers, positional isomers, functional group isomers.

        Reactions: substitution (alkanes), addition (alkenes), elimination,
        esterification (acid + alcohol → ester + water).
        Combustion of hydrocarbons: CₙHₘ + O₂ → CO₂ + H₂O (+ energy).
        Relevant to SA: crude oil refining at SAPREF (Durban) and NATREF.
        """,
    },
    {
        "metadata": {"subject": "physical_sciences", "grade": 12, "topic": "chemistry",
                     "title": "Electrochemistry — Galvanic and Electrolytic Cells — Grade 12 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Electrochemistry — Grade 12 Physical Sciences (CAPS)

        Oxidation: loss of electrons (OIL — Oxidation Is Loss).
        Reduction: gain of electrons (RIG — Reduction Is Gain).
        Redox reaction: oxidation and reduction occur simultaneously.
        Oxidising agent: gains electrons (is reduced).
        Reducing agent: loses electrons (is oxidised).

        Standard electrode potentials (E°):
        Measured relative to the standard hydrogen electrode (E° = 0 V).
        More positive E° → stronger oxidising agent → greater tendency to be reduced.
        More negative E° → stronger reducing agent.
        Electrochemical series: table of standard reduction potentials.

        Galvanic (voltaic) cell: spontaneous redox reaction generates electrical energy.
        Anode: oxidation occurs (negative terminal). Anode loses mass.
        Cathode: reduction occurs (positive terminal). Cathode gains mass.
        Salt bridge: maintains electrical neutrality (allows ion flow).
        Cell notation: anode | anode solution || cathode solution | cathode.
        EMF of cell: E°cell = E°cathode - E°anode. Positive EMF = spontaneous.

        Electrolytic cell: electrical energy drives a non-spontaneous reaction.
        Anode: oxidation (connected to positive terminal of battery).
        Cathode: reduction (connected to negative terminal).
        Applications: electroplating, refining metals, production of aluminium
        (Hall-Héroult process), chlorine production.

        Corrosion: electrochemical process where metals oxidise.
        Iron rusting: 4Fe + 3O₂ + 6H₂O → 2Fe₂O₃·3H₂O
        Prevention: painting, galvanising (zinc coating), cathodic protection.
        Infrastructure corrosion costs South Africa billions annually.
        """,
    },
    {
        "metadata": {"subject": "physical_sciences", "grade": 12, "topic": "modern_physics",
                     "title": "Photoelectric Effect and Wave-Particle Duality — Grade 12 Physical Sciences",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Photoelectric Effect — Grade 12 Physical Sciences (CAPS)

        The photoelectric effect: when light shines on a metal surface, electrons are
        emitted if the light's frequency is above a threshold frequency (f₀).

        Key observations (unexplained by wave theory, explained by quantum theory):
        - Below threshold frequency: no electrons emitted regardless of intensity.
        - Above threshold: electrons emitted immediately, even at low intensity.
        - Increasing intensity above f₀ increases number of electrons, not their energy.
        - Increasing frequency above f₀ increases kinetic energy of electrons.

        Einstein's explanation (1905, Nobel Prize 1921):
        Light consists of discrete packets of energy called photons.
        Energy of a photon: E = hf = hc/λ
        h = Planck's constant = 6.63 × 10⁻³⁴ J·s
        f = frequency, c = 3 × 10⁸ m·s⁻¹, λ = wavelength.

        Work function (W₀): minimum energy to free an electron from the metal surface.
        W₀ = hf₀ (energy of the threshold photon).

        Einstein's photoelectric equation:
        Ek_max = hf - W₀ = hf - hf₀
        Maximum kinetic energy of emitted electrons.

        Stopping potential (V₀): voltage needed to stop the fastest electrons.
        Ek_max = eV₀ (e = 1.6 × 10⁻¹⁹ C).

        Wave-particle duality:
        Light behaves as a wave (interference, diffraction) AND as a particle (photon).
        de Broglie: matter also has wave properties. λ = h/mv (matter wavelength).
        Electrons show diffraction — confirmed experimentally.

        Applications: solar cells (photovoltaic), photomultiplier tubes, CCDs in cameras.
        SA solar energy context: South Africa has some of the world's highest solar irradiance,
        making the photoelectric effect practically relevant for renewable energy.
        """,
    },
]

# ---------------------------------------------------------------------------
# ECONOMICS — additional topics
# ---------------------------------------------------------------------------

ECONOMICS_V2: list[dict] = [
    {
        "metadata": {"subject": "economics", "grade": 10, "topic": "microeconomics",
                     "title": "Production, Costs and Revenue — Grade 10 Economics",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Production, Costs and Revenue — Grade 10 Economics (CAPS)

        Factors of production (inputs used to produce goods and services):
        Land: natural resources (soil, minerals, water). Reward: rent.
        Labour: human effort. Reward: wages and salaries.
        Capital: man-made tools and machinery used in production. Reward: interest.
        Entrepreneurship: organises the other factors, takes risk. Reward: profit.

        South Africa's key natural resources: gold, platinum, coal, diamonds,
        iron ore, chromium. Mining sector remains important despite decline.

        Types of costs:
        Fixed costs (FC): do not change with output level. Example: rent, insurance,
        loan repayments. Even if output = 0, fixed costs must still be paid.
        Variable costs (VC): change as output changes. Example: raw materials,
        electricity, piece-rate wages.
        Total costs (TC): TC = FC + VC.
        Average total cost (ATC): ATC = TC/Q (Q = quantity of output).
        Marginal cost (MC): additional cost of producing one more unit.
        MC = ΔTC/ΔQ.

        Revenue:
        Total revenue (TR): TR = Price × Quantity sold.
        Average revenue (AR): AR = TR/Q = Price (for a firm in perfect competition).
        Marginal revenue (MR): additional revenue from selling one more unit.

        Profit: Profit = TR - TC.
        Normal profit: when TR = TC (economic profit = 0). Firm covers all costs
        including opportunity cost. Enough to keep firm in the industry.
        Supernormal (abnormal) profit: TR > TC. Attracts new entrants.
        Loss: TR < TC. Firm may shut down if loss > fixed costs (in short run).

        Law of diminishing returns: as more variable inputs are added to fixed inputs,
        output eventually increases at a decreasing rate.
        """,
    },
    {
        "metadata": {"subject": "economics", "grade": 10, "topic": "macroeconomics",
                     "title": "Economic Systems — Capitalism, Socialism, Mixed Economy — Grade 10 Economics",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Economic Systems — Grade 10 Economics (CAPS)

        An economic system is the way a society organises production, distribution,
        and consumption of goods and services.

        The three basic economic questions every system must answer:
        1. What to produce? (which goods and services)
        2. How to produce? (which methods and resources)
        3. For whom to produce? (how output is distributed)

        Free market (capitalist) economy:
        Resources owned by private individuals and firms.
        Prices determined by supply and demand.
        Profit motive drives production decisions.
        Minimal government intervention.
        Advantages: efficiency, innovation, consumer choice.
        Disadvantages: inequality, public goods under-provided, market failures.
        Examples: USA, Hong Kong.

        Command (socialist/communist) economy:
        Government owns resources and makes all economic decisions.
        Central planning determines what and how much to produce.
        Advantages: equality of distribution, no unemployment (theoretically).
        Disadvantages: inefficiency, poor incentives, lack of innovation.
        Historical examples: USSR, Cuba, North Korea.

        Mixed economy (most common today):
        Combines private enterprise with government intervention.
        Market mechanism determines most prices.
        Government provides public goods, regulates markets, redistributes income.
        South Africa operates a mixed economy: private sector dominant, but
        government plays significant role through SOEs, taxation, social grants,
        BEE policies, and industrial policy.

        Traditional economy:
        Based on customs and traditions. Subsistence production.
        Common in rural parts of Southern Africa.
        Barter system may be used instead of money.
        """,
    },
    {
        "metadata": {"subject": "economics", "grade": 11, "topic": "microeconomics",
                     "title": "Environmental Sustainability and Market Failure — Grade 11 Economics",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Environmental Economics and Sustainability — Grade 11 Economics (CAPS)

        Market failure: when the free market produces an inefficient allocation of resources.
        Types of market failure: public goods, externalities, information asymmetry, monopoly.

        Externalities: costs or benefits that affect third parties not involved in the transaction.
        Negative externality: cost imposed on others (e.g. factory pollution, traffic congestion).
        Firms producing pollution generate a social cost greater than private cost.
        Result: overproduction of polluting goods at too low a price.
        Positive externality: benefit enjoyed by others (e.g. vaccination herd immunity, education).
        Result: underproduction of goods with social benefits.

        Government responses to negative externalities:
        Taxes (Pigouvian tax): charge firms per unit of pollution to internalise social cost.
        South Africa's carbon tax (2019): charges large emitters for greenhouse gas emissions.
        Regulations: set emission limits. South Africa's Air Quality Act.
        Tradeable permits: firms can buy and sell the right to pollute up to a cap.
        Subsidies for clean alternatives: solar, wind, electric vehicles.

        Sustainable development: meeting the needs of the present without compromising the
        ability of future generations to meet their own needs. (Brundtland definition, 1987)

        South Africa's environmental challenges:
        Eskom's coal-fired power stations (Medupi, Kusile) produce large CO₂ emissions.
        Water scarcity: SA is a water-stressed country (rainfall below world average).
        Load shedding paradox: causes some emission reductions but drives diesel generator use.
        Just transition: moving from coal economy while protecting workers' livelihoods.
        National Climate Change Response Policy aims to reduce emissions and adapt.

        Green economy: economic activity that improves human well-being while reducing
        environmental risk. Renewable energy, green buildings, sustainable agriculture.
        """,
    },
    {
        "metadata": {"subject": "economics", "grade": 12, "topic": "macroeconomics",
                     "title": "Money, Banking and the Financial Sector — Grade 12 Economics",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Money and Banking — Grade 12 Economics (CAPS)

        Functions of money:
        Medium of exchange: eliminates need for barter.
        Unit of account: common measure of value.
        Store of value: holds purchasing power over time (affected by inflation).
        Standard of deferred payment: used for credit transactions.

        The South African banking system:
        South African Reserve Bank (SARB): central bank, monetary authority.
        Issues banknotes and coins, manages foreign exchange reserves,
        supervises banking system (Prudential Authority).

        Commercial banks (money creation):
        Accept deposits, make loans — creating new money through credit.
        Reserve requirement: banks must hold a fraction of deposits as reserves.
        Money multiplier: 1/reserve ratio. If reserve ratio = 10%, R1 deposited
        can create R10 of new money through successive lending.
        South Africa's major banks: ABSA, FNB (First National Bank), Standard Bank,
        Nedbank, Capitec (fastest-growing retail bank).

        Financial markets:
        Johannesburg Stock Exchange (JSE): equity market for shares.
        Bond market: government and corporate bonds.
        Foreign exchange market: buying and selling currencies.
        Derivatives market: options, futures, forwards.

        Financial intermediation: banks channel savings into investment.
        They borrow short-term (deposits) and lend long-term (mortgages, business loans).
        This maturity transformation exposes banks to liquidity risk.

        Banking regulation in SA:
        Banks Act regulates commercial banks.
        Basel III capital requirements ensure banks hold sufficient capital buffers.
        Deposit Insurance (CODI): covers bank depositors up to R100 000 per person
        in case of bank failure. Launched 2024.

        National Payment System (NPS): infrastructure for electronic payments.
        SAMOS (South African Multiple Option Settlement): real-time gross settlement.
        """,
    },
    {
        "metadata": {"subject": "economics", "grade": 12, "topic": "macroeconomics",
                     "title": "Redistribution and Poverty Alleviation — Grade 12 Economics",
                     "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Redistribution, Poverty and Inequality — Grade 12 Economics (CAPS)

        South Africa's inequality context:
        Gini coefficient ~0.63 — one of the highest globally.
        Apartheid created deliberate spatial and economic inequality.
        Legacy includes: racially skewed asset ownership, poor education in townships
        and rural areas, restricted job access by race until 1994.

        Measuring poverty:
        Poverty line: minimum income needed for basic needs.
        Stats SA uses three poverty lines (2022 prices):
        Food poverty line: ~R663 per person per month (cannot afford minimum food).
        Lower-bound poverty line: ~R890 per person per month.
        Upper-bound poverty line: ~R1 558 per person per month.
        Over 55% of South Africans live below the upper-bound line.

        Government redistribution instruments:
        Progressive taxation: higher income earners pay higher percentage.
        Social grants (SASSA): old age (R2 090/month), child support (R530/child),
        disability grant, foster care grant, SRD grant (Social Relief of Distress).
        Over 18 million South Africans receive grants — largest social protection
        programme in sub-Saharan Africa.

        Education and health spending:
        Largest components of government budget.
        Free basic education (no-fee schools) and fee-free higher education (NSFAS).
        National Health Insurance (NHI): proposed universal health coverage for SA.

        Land reform:
        Restitution: returning land to communities dispossessed after 1913.
        Redistribution: government purchases land for transfer to landless people.
        Tenure security: protecting rights of people on communal or farm land.
        Land remains politically contentious — expropriation without compensation debated.

        B-BBEE: Broad-Based Black Economic Empowerment.
        Scorecard measures ownership, management control, skills development,
        enterprise development and supplier development.
        Aims to transform economic participation.
        """,
    },
]


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def main() -> None:
    env_source = _load_env()
    print(f"Loaded env from: {env_source}")

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://iplliihtphnhgxqmxxdo.supabase.co").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not key:
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY is required. Add to apps/web/.env.local")
        sys.exit(1)

    supabase = create_client(url, key)
    model = SentenceTransformer("all-MiniLM-L6-v2", device="cuda")
    print(f"Model device: {model.device}\n")

    batches = [
        ("MATHEMATICS (extended)", MATHS_V2),
        ("PHYSICAL SCIENCES (extended)", PHYSICS_V2),
        ("ECONOMICS (extended)", ECONOMICS_V2),
    ]

    total = 0
    for label, docs in batches:
        print(f"── {label} ({len(docs)} documents) ──")
        for doc in docs:
            total += ingest(supabase, model, doc["content"], doc["metadata"])

    print(f"\nDone — {total} total new chunks in Supabase ✅")


if __name__ == "__main__":
    main()
