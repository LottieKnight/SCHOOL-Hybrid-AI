"""
SCHOOL RAG — CAPS Seed v3
Life Sciences, Accounting, Geography, History, Business Studies (Gr10–12)
30 documents | 6 per subject

Usage:
  source ~/gpu-env/bin/activate
  python -m scripts.seed_caps_v3
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from supabase import create_client


def _load_env() -> str:
    loaded = []
    for candidate in [
        Path(".env.local"),
        Path("apps/web/.env.local"),
        Path(__file__).parent.parent / "apps/web/.env.local",
    ]:
        if candidate.exists() and str(candidate.resolve()) not in [
            str(p.resolve()) for p in loaded
        ]:
            load_dotenv(candidate, override=True)
            loaded.append(candidate)
    return ", ".join(str(p) for p in loaded) if loaded else "shell environment"


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    step = chunk_size - overlap
    for i in range(0, len(words), step):
        chunk = " ".join(words[i : i + chunk_size]).strip()
        if chunk:
            chunks.append(chunk)
    return chunks


def ingest(supabase, model: SentenceTransformer, content: str, metadata: dict, batch_size: int = 32) -> int:
    chunks = chunk_text(content)
    if not chunks:
        return 0
    print(f"  Embedding {len(chunks)} chunks for: {metadata.get('title', 'unknown')}")
    embeddings = model.encode(chunks, batch_size=batch_size, show_progress_bar=True)
    rows = [{"content": c, "embedding": e.tolist(), "metadata": metadata} for c, e in zip(chunks, embeddings)]
    result = supabase.table("documents").insert(rows).execute()
    count = len(result.data) if result.data else 0
    print(f"  Inserted {count} rows ✅")
    return count


# ---------------------------------------------------------------------------
# Life Sciences
# ---------------------------------------------------------------------------
LIFE_SCIENCES: list[dict] = [
    {
        "metadata": {"subject": "life_sciences", "grade": 10, "topic": "cells", "title": "Cell Structure and Cell Division (Mitosis) — Grade 10 Life Sciences", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        The Cell — the basic structural and functional unit of all living organisms.

        Cell types:
        - Prokaryotic cells: no membrane-bound nucleus (bacteria). Simple internal structure.
        - Eukaryotic cells: membrane-bound nucleus, organelles (plants, animals, fungi).

        Key organelles and functions:
        - Nucleus: contains DNA; controls cell activities.
        - Mitochondria: site of aerobic respiration; produces ATP (energy currency).
        - Chloroplast (plant only): site of photosynthesis; contains chlorophyll.
        - Ribosome: site of protein synthesis (translation of mRNA).
        - Endoplasmic reticulum (ER): rough ER synthesises proteins; smooth ER synthesises lipids.
        - Golgi apparatus: packages and ships proteins to destinations.
        - Vacuole: large central vacuole in plant cells stores water (turgor pressure).
        - Cell membrane: phospholipid bilayer; selective permeability controls what enters/exits.
        - Cell wall (plant only): cellulose; provides rigidity and shape.

        Cell division — Mitosis:
        Purpose: growth, repair, and asexual reproduction. Produces two genetically identical diploid daughter cells.

        Phases of mitosis (PMAT):
        1. Prophase: chromatin condenses into visible chromosomes; nuclear membrane breaks down; spindle fibres form.
        2. Metaphase: chromosomes align at the cell equator (metaphase plate); spindle fibres attach to centromeres.
        3. Anaphase: sister chromatids pulled to opposite poles by spindle fibres; cell elongates.
        4. Telophase: nuclear membranes reform around each set of chromosomes; chromosomes decondense.
        Cytokinesis follows: cytoplasm divides — cleavage furrow in animal cells; cell plate in plant cells.

        Cell cycle: G1 (growth) → S phase (DNA replication) → G2 (prep) → M phase (mitosis + cytokinesis).
        Human somatic cells have 46 chromosomes (23 pairs). After mitosis: still 46.
        """,
    },
    {
        "metadata": {"subject": "life_sciences", "grade": 10, "topic": "biodiversity", "title": "Biodiversity and Classification of Organisms — Grade 10 Life Sciences", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Biodiversity refers to the variety of life on Earth — genetic diversity, species diversity, and ecosystem diversity.

        South Africa is one of 17 megadiverse countries globally, home to the Cape Floristic Region (a global biodiversity hotspot).

        Classification (Taxonomy):
        Organisms are grouped using a hierarchical system: Domain → Kingdom → Phylum → Class → Order → Family → Genus → Species.
        Mnemonic: Dear King Philip Came Over For Good Soup.

        Five kingdoms (traditional):
        1. Monera (prokaryotes — bacteria, cyanobacteria)
        2. Protista (unicellular eukaryotes — amoeba, Plasmodium)
        3. Fungi (heterotrophs; cell walls of chitin; reproduce by spores — mushrooms, mould, yeast)
        4. Plantae (multicellular; autotrophs via photosynthesis; cellulose cell walls)
        5. Animalia (multicellular; heterotrophs; no cell wall)

        Binomial nomenclature: two-part Latin name — Genus species (e.g., Homo sapiens).
        Rules: Genus capitalised, species lowercase; italicised or underlined.

        Viruses: NOT classified as living — no cells, no metabolism; replicate only inside host cells.
        Viruses cause: HIV/AIDS, influenza, COVID-19, rabies, polio.

        Dichotomous key: tool used to identify organisms using a series of paired statements based on observable characteristics.

        Endangered species in SA: rhinoceros (poaching), African penguin (food competition, oil spills), Cape vulture (poisoning, collisions).
        CITES: international agreement controlling trade in endangered species.
        South Africa's National Biodiversity Strategy: SANBI (SA National Biodiversity Institute) oversees conservation.
        """,
    },
    {
        "metadata": {"subject": "life_sciences", "grade": 11, "topic": "animal_nutrition", "title": "Animal Nutrition and the Digestive System — Grade 11 Life Sciences", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Nutrition is the process by which organisms obtain and use food for energy, growth, and repair.

        Heterotrophs obtain food by eating other organisms (animals, fungi).
        Autotrophs produce their own food (plants via photosynthesis).

        Human digestive system — organs and functions:
        - Mouth: mechanical digestion (chewing); amylase (salivary) begins starch digestion.
        - Oesophagus: peristalsis moves food to stomach.
        - Stomach: HCl creates acidic environment (pH 2); pepsin digests proteins; churning = mechanical digestion.
        - Small intestine (3 parts — duodenum, jejunum, ileum):
          - Pancreatic juice: amylase (starch), lipase (fats), protease (proteins).
          - Bile (from liver, stored in gallbladder): emulsifies fat (physical, not chemical).
          - Villi and microvilli: increase surface area; absorb nutrients into blood and lymph.
        - Large intestine: absorbs water and minerals; compacts waste into faeces.
        - Rectum and anus: storage and egestion of faeces.

        Enzymes are biological catalysts — proteins that speed up chemical reactions without being consumed.
        Enzyme properties: specific (lock and key model), affected by temperature and pH.
        Optimum temp for human enzymes: ~37°C. Denaturing occurs above ~45°C.

        Nutrients and their roles:
        - Carbohydrates: primary energy source (glucose → ATP via respiration).
        - Proteins: growth and repair; enzymes, hormones, antibodies.
        - Fats: energy storage; cell membrane structure; fat-soluble vitamins.
        - Vitamins and minerals: co-factors; deficiency diseases (e.g., Vit C → scurvy; iron → anaemia).
        - Water: solvent; transport medium; temperature regulation.

        Malnutrition in SA: kwashiorkor (protein deficiency), marasmus (calorie deficiency) — major public health challenges linked to poverty.
        """,
    },
    {
        "metadata": {"subject": "life_sciences", "grade": 11, "topic": "dna", "title": "DNA Structure and Protein Synthesis — Grade 11 Life Sciences", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        DNA (Deoxyribonucleic acid) — the molecule that carries genetic information in all living cells.

        Structure of DNA (Watson and Crick, 1953):
        - Double helix: two antiparallel strands wound around each other.
        - Each strand is a polynucleotide: nucleotides linked by phosphodiester bonds.
        - Each nucleotide: deoxyribose sugar + phosphate group + nitrogenous base.
        - Four bases: Adenine (A), Thymine (T), Guanine (G), Cytosine (C).
        - Base pairing rules (Chargaff's rules): A pairs with T (2 H-bonds); G pairs with C (3 H-bonds).
        - The two strands are complementary and antiparallel (one runs 5'→3', the other 3'→5').

        DNA replication (S phase of cell cycle):
        - Semi-conservative: each new molecule has one original strand and one new strand.
        - Helicase unwinds the double helix.
        - DNA polymerase adds complementary nucleotides to each template strand.

        Protein synthesis — two stages:

        1. Transcription (nucleus):
           - DNA double helix unwinds.
           - RNA polymerase reads the template strand and builds a complementary mRNA strand.
           - mRNA uses Uracil (U) instead of Thymine — A pairs with U.
           - mRNA leaves the nucleus through nuclear pores.

        2. Translation (ribosome in cytoplasm):
           - mRNA binds to ribosome.
           - tRNA molecules bring specific amino acids; each tRNA has an anticodon complementary to an mRNA codon.
           - Codons are 3-nucleotide sequences; 64 possible codons code for 20 amino acids.
           - Polypeptide chain elongates until a stop codon is reached.
           - The polypeptide folds into a functional protein.

        Mutations: changes in DNA sequence. Can be substitution, insertion, or deletion.
        Point mutations may have no effect (silent), alter protein function (missense), or create a stop codon (nonsense).
        Mutagens: UV radiation, X-rays, certain chemicals (e.g., tobacco carcinogens).
        """,
    },
    {
        "metadata": {"subject": "life_sciences", "grade": 12, "topic": "meiosis", "title": "Meiosis, Sexual Reproduction and Genetics — Grade 12 Life Sciences", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Meiosis — cell division producing haploid gametes (sex cells) for sexual reproduction.
        Produces 4 genetically different haploid cells (n) from one diploid cell (2n).
        Humans: 2n = 46 chromosomes → gametes with n = 23 chromosomes.
        Fertilisation restores the diploid number.

        Meiosis I (reduction division):
        - Prophase I: homologous chromosomes pair (synapsis); crossing over (recombination) occurs — genetic variation.
        - Metaphase I: homologous pairs align at equator.
        - Anaphase I: homologous chromosomes separate (not sister chromatids).
        - Telophase I: two haploid cells form (still with sister chromatids joined).

        Meiosis II (similar to mitosis):
        - Sister chromatids separate → 4 haploid daughter cells.

        Sources of genetic variation: crossing over, independent assortment, random fertilisation.

        Mendelian Genetics:
        - Gregor Mendel's laws derived from pea plant experiments.
        - Law of Segregation: alleles separate during gamete formation; each gamete carries one allele.
        - Law of Independent Assortment: genes on different chromosomes assort independently.

        Terminology:
        - Genotype: genetic makeup (e.g., Tt). Phenotype: observable trait (e.g., tall).
        - Homozygous: both alleles the same (TT or tt). Heterozygous: different alleles (Tt).
        - Dominant: masks recessive. Recessive: only expressed when homozygous.

        Monohybrid cross (Punnett square):
        Tt × Tt → TT : Tt : tt = 1:2:1 genotype ratio; 3 tall : 1 short phenotype ratio.

        Dihybrid cross: two gene loci; 9:3:3:1 phenotype ratio in F2 generation.

        Incomplete dominance: neither allele fully dominant — intermediate phenotype (e.g., red × white → pink flowers).
        Codominance: both alleles expressed (e.g., ABO blood groups — type AB expresses both A and B antigens).

        Sex determination in humans: XX = female, XY = male. Y chromosome carries SRY gene.
        Sex-linked traits: genes carried on X chromosome (e.g., haemophilia, colour blindness).
        Females can be carriers (X^H X^h); males are either affected or not (X^h Y).
        """,
    },
    {
        "metadata": {"subject": "life_sciences", "grade": 12, "topic": "evolution", "title": "Evolution and Natural Selection — Grade 12 Life Sciences", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Evolution is the change in the inherited characteristics of a population over successive generations.

        Charles Darwin's Theory of Natural Selection (1859 — On the Origin of Species):
        1. Variation: individuals in a population show heritable variation.
        2. Overproduction: organisms produce more offspring than can survive.
        3. Competition: individuals compete for limited resources (food, mates, space).
        4. Survival of the fittest: individuals with advantageous traits survive and reproduce more.
        5. Inheritance: advantageous traits are passed to offspring → frequency increases over generations.

        Key evidence for evolution:
        - Fossil record: shows progression of life forms over geological time; transitional fossils.
        - Comparative anatomy: homologous structures (same evolutionary origin, different function — human arm, whale flipper, bat wing). Analogous structures (same function, different origin — bird wing, insect wing).
        - Vestigial structures: reduced organs with no current function (human tailbone, appendix).
        - Molecular evidence: DNA and protein similarities between related species.
        - Biogeography: geographic distribution of species (e.g., marsupials in Australia).

        Types of natural selection:
        - Directional: one extreme phenotype favoured — population shifts toward that extreme.
        - Stabilising: intermediate phenotype favoured — extremes selected against.
        - Disruptive: both extremes favoured — population splits into two groups.

        Speciation: formation of new species. Occurs when populations become reproductively isolated.
        - Allopatric speciation: geographic isolation (mountain range, ocean).
        - Sympatric speciation: reproductive isolation without geographic separation.

        Human evolution:
        - Hominids (family Hominidae): bipedal, large brains, tool use.
        - Key fossils in Africa: Australopithecus africanus (Taung Child — SA), Homo habilis, Homo erectus, Homo sapiens.
        - Out of Africa hypothesis: modern humans evolved in Africa ~200,000 years ago and migrated globally.
        - South Africa is globally significant for palaeontology: Cradle of Humankind (UNESCO World Heritage Site).
        """,
    },
]

# ---------------------------------------------------------------------------
# Accounting
# ---------------------------------------------------------------------------
ACCOUNTING: list[dict] = [
    {
        "metadata": {"subject": "accounting", "grade": 10, "topic": "accounting_concepts", "title": "Accounting Concepts and the Accounting Equation — Grade 10 Accounting", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Accounting is the systematic recording, reporting, and analysis of financial transactions of a business.

        GAAP — Generally Accepted Accounting Practice: the rules governing how financial records are kept in South Africa.
        Key GAAP principles:
        - Business entity: business finances kept separate from owner's personal finances.
        - Going concern: assume the business will continue operating indefinitely.
        - Historical cost: assets recorded at original purchase price.
        - Matching principle: expenses matched to the revenue they helped generate (accrual basis).
        - Consistency: same accounting methods used from period to period.
        - Materiality: only significant items need detailed recording.
        - Prudence (conservatism): do not overstate assets or income; provide for possible losses.

        The Accounting Equation:
        Assets = Owners' Equity + Liabilities
        Or: Assets = Capital + Liabilities

        Definitions:
        - Assets: resources owned by the business with future economic value (cash, equipment, inventory, debtors).
        - Liabilities: amounts owed to outsiders (creditors, bank loans, SARS).
        - Owners' Equity (Capital): owner's claim on assets = Assets − Liabilities.
          Capital changes: increases with profit and additional contributions; decreases with losses and drawings.

        The accounting equation ALWAYS balances. Every transaction has a dual effect (double-entry principle):
        e.g., Buy equipment for cash: Equipment (asset ↑) and Cash (asset ↓) — equation stays balanced.
        e.g., Owner invests cash: Cash (asset ↑) and Capital (equity ↑).

        Financial accounting cycle: source documents → journals → ledgers → trial balance → financial statements.
        Source documents: invoices, receipts, cheque stubs, debit/credit notes, bank statements.

        Types of accounts: Assets (debit increases), Liabilities (credit increases), Equity (credit increases), Income (credit increases), Expenses (debit increases).
        """,
    },
    {
        "metadata": {"subject": "accounting", "grade": 10, "topic": "ledger", "title": "Ledger Accounts, Journals and Trial Balance — Grade 10 Accounting", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        The General Ledger is the master record of all accounts in a business.
        T-accounts: left side = Debit (Dr); right side = Credit (Cr).

        Debits and Credits rules:
        - Assets increase on debit; decrease on credit.
        - Liabilities increase on credit; decrease on debit.
        - Equity increases on credit; decreases on debit.
        - Income increases on credit; decreases on debit.
        - Expenses increase on debit; decrease on credit.
        Mnemonic: DEAD CLIC (Debit: Expenses, Assets, Drawings | Credit: Liabilities, Income, Capital).

        Journals (books of first entry) — records transactions before posting to ledger:
        - Cash Receipts Journal (CRJ): all cash received.
        - Cash Payments Journal (CPJ): all cash paid.
        - Debtors Journal (DJ): credit sales to debtors.
        - Creditors Journal (CJ): credit purchases from creditors.
        - General Journal (GJ): adjustments, corrections, non-cash transactions.

        Posting to the ledger: each journal entry posted to the appropriate account in the general ledger.

        Trial Balance:
        - A list of all ledger account balances at a point in time.
        - Total debits must equal total credits if double-entry bookkeeping is correct.
        - Errors a trial balance will NOT detect: errors of omission, compensating errors, errors of principle (wrong account type), errors of commission (wrong account, same type), transposition errors.

        Bank Reconciliation Statement:
        - Compares the Cash at Bank ledger balance with the bank statement balance.
        - Differences arise from: outstanding cheques (issued but not yet cleared), deposits not yet credited, bank charges, dishonoured cheques.
        - Formula: Bank statement balance ± adjustments = Corrected bank balance = Cash at bank ledger balance (after corrections).
        """,
    },
    {
        "metadata": {"subject": "accounting", "grade": 11, "topic": "financial_statements", "title": "Company Financial Statements — Income Statement and Balance Sheet — Grade 11 Accounting", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Companies (Ltd) must prepare annual financial statements in terms of the Companies Act 71 of 2008.

        Income Statement (Statement of Comprehensive Income):
        Shows profitability over a period (e.g., year ended 28 February).

        Structure:
        Net Sales (turnover)
        − Cost of Sales (opening stock + purchases − closing stock)
        = Gross Profit
        + Other income (rent income, interest received, bad debts recovered)
        − Operating expenses (admin, marketing, depreciation, bad debts)
        = Operating Profit (EBIT)
        − Interest expense (on loans)
        = Net Profit Before Tax
        − Income Tax
        = Net Profit After Tax

        Net Profit After Tax is appropriated:
        − Ordinary dividends (paid to shareholders)
        = Retained Income (added to Shareholders' Equity on balance sheet)

        Balance Sheet (Statement of Financial Position):
        Shows financial position on a specific date.

        Assets side:
        Non-Current Assets: fixed assets at cost − accumulated depreciation = carrying value (land, buildings, equipment, vehicles). Intangible assets (goodwill, patents).
        Current Assets: inventory, debtors (− provision for bad debts), cash, prepaid expenses.

        Equity and Liabilities side:
        Shareholders' Equity: share capital + retained income + reserves.
        Non-Current Liabilities: mortgage loans, long-term borrowings.
        Current Liabilities: creditors, bank overdraft, SARS (tax payable), accrued expenses, shareholders for dividends.

        Depreciation — allocates the cost of a fixed asset over its useful life:
        Straight-line method: (Cost − Residual value) ÷ Useful life (years) — equal annual charge.
        Diminishing balance method: Cost × depreciation % each year (higher charge in early years).
        """,
    },
    {
        "metadata": {"subject": "accounting", "grade": 11, "topic": "cash_flow", "title": "Cash Flow Statement and Analysis of Liquidity — Grade 11 Accounting", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        The Cash Flow Statement shows how cash moved in and out of the business during the period.
        A company can be profitable but still run out of cash (liquidity crisis) — hence the statement's importance.

        Three sections:
        1. Cash flows from operating activities:
           Net profit before tax + non-cash items (add back depreciation) ± changes in working capital (inventory, debtors, creditors) − tax paid = Net cash from operations.

        2. Cash flows from investing activities:
           Purchase/sale of fixed assets (non-current assets). Cash outflows if expanding; inflows if selling.

        3. Cash flows from financing activities:
           Issue of shares (inflow), repayment of loans (outflow), payment of dividends (outflow), new loans raised (inflow).

        Net increase/decrease in cash = sum of three sections.
        Opening cash balance + net change = Closing cash balance (agrees with balance sheet).

        Ratio Analysis — evaluating financial performance:

        Liquidity ratios (can the business pay short-term debts?):
        - Current ratio = Current assets ÷ Current liabilities. Ideal: ≈ 2:1.
        - Acid-test (quick) ratio = (Current assets − Inventory) ÷ Current liabilities. Ideal: ≈ 1:1.

        Profitability ratios:
        - Gross profit % = Gross profit ÷ Net sales × 100. Shows markup control.
        - Net profit % = Net profit after tax ÷ Net sales × 100.
        - Return on equity = Net profit after tax ÷ Shareholders' equity × 100.

        Solvency (long-term financial health):
        - Debt ratio = Total liabilities ÷ Total assets. Lower is safer.
        - Debt:Equity ratio = Total liabilities ÷ Shareholders' equity.

        Activity ratios:
        - Stock turnover = Cost of sales ÷ Average inventory. Higher = stock sold faster.
        - Debtors collection period = (Debtors ÷ Credit sales) × 365. Lower is better.
        """,
    },
    {
        "metadata": {"subject": "accounting", "grade": 12, "topic": "manufacturing", "title": "Manufacturing Accounts and Cost Accounting — Grade 12 Accounting", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Manufacturing businesses produce goods — they have an additional account (Manufacturing Account) before the Income Statement.

        Types of costs in manufacturing:
        1. Direct (Prime) costs — directly traceable to the product:
           - Direct materials (raw materials used in production).
           - Direct labour (factory workers' wages directly on production).
           Together: Prime cost = Direct materials + Direct labour.

        2. Factory overhead (indirect costs):
           - Indirect materials (factory consumables — oil, cleaning).
           - Indirect labour (factory supervisor salaries, security).
           - Factory rent, depreciation of machinery, factory electricity.
           Total: Factory overhead.

        Manufacturing Account structure:
        Opening WIP (Work in Progress)
        + Prime cost (direct materials + direct labour)
        + Factory overhead
        − Closing WIP
        = Cost of production (finished goods manufactured)

        Cost of Sales in Trading Account:
        Opening finished goods inventory
        + Cost of production
        − Closing finished goods inventory
        = Cost of Sales

        Cost behaviour:
        - Fixed costs: remain constant regardless of output (rent, insurance).
        - Variable costs: change proportionally with output (raw materials, direct labour).
        - Semi-variable costs: fixed component + variable component (electricity — fixed charge + per-unit charge).

        Break-even analysis:
        Break-even point = Fixed costs ÷ Contribution per unit.
        Contribution per unit = Selling price per unit − Variable cost per unit.
        At break-even: Total revenue = Total costs (no profit, no loss).
        Margin of safety = Budgeted sales − Break-even sales. Shows how far sales can fall before a loss occurs.

        Internal audit and controls: segregation of duties, authorisation limits, physical controls (safes, locks), regular stock counts, reconciliations. Important for preventing fraud — relevant given SA's high fraud rates.
        """,
    },
    {
        "metadata": {"subject": "accounting", "grade": 12, "topic": "analysis", "title": "Interpretation and Analysis of Financial Statements — Grade 12 Accounting", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Financial statement analysis allows stakeholders (shareholders, managers, investors, banks, SARS) to evaluate business performance and make informed decisions.

        Key stakeholders and their interests:
        - Shareholders: profitability, return on investment, dividends.
        - Banks/lenders: solvency, ability to repay loans (liquidity and debt ratios).
        - Management: efficiency, cost control, working capital management.
        - Employees/unions: profitability (wages), stability (going concern).
        - SARS: taxable income.

        Comprehensive ratio analysis:

        Profitability:
        - Gross profit %: falling GP% → prices cut or cost of sales increased (theft, wastage).
        - Net profit %: falling NP% → operating expenses risen faster than revenue.
        - Return on Assets (ROA) = EBIT ÷ Total assets × 100.
        - Return on Equity (ROE) = Net profit after tax ÷ Shareholders' equity × 100.
        - Earnings Per Share (EPS) = Net profit after tax ÷ Number of shares issued.
        - Dividends Per Share (DPS) = Total dividends ÷ Number of shares.

        Efficiency:
        - Stock turnover rate: low rate → slow-moving/obsolete stock.
        - Debtors collection period: >30 days may indicate poor credit control.
        - Creditors payment period: too fast depletes cash; too slow damages supplier relations.

        Leverage/Solvency:
        - Gearing ratio = Long-term liabilities ÷ Shareholders' equity × 100.
        - High gearing = risk (interest burden); low gearing = over-reliance on equity.

        Market performance (listed companies):
        - Price:Earnings (P:E) ratio = Market price per share ÷ EPS. High P:E = market expects high growth.
        - Dividend yield = DPS ÷ Market price × 100.
        - Net asset value (NAV) per share = Total shareholders' equity ÷ Number of shares.

        Trend analysis: compare ratios over multiple years to spot deterioration or improvement.
        Comparative analysis: compare ratios against industry benchmarks (e.g., JSE sector averages).

        Limitations: ratios are based on historical data; window dressing can inflate ratios; inflation distorts comparisons.
        """,
    },
]

# ---------------------------------------------------------------------------
# Geography
# ---------------------------------------------------------------------------
GEOGRAPHY: list[dict] = [
    {
        "metadata": {"subject": "geography", "grade": 10, "topic": "atmosphere", "title": "Atmosphere — Weather Systems and Climate — Grade 10 Geography", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        The atmosphere is a layer of gases surrounding Earth, held by gravity. It makes life possible by regulating temperature, providing oxygen, and filtering harmful UV radiation.

        Layers of the atmosphere:
        - Troposphere (0–12 km): weather occurs here; temperature decreases with altitude; contains most water vapour.
        - Stratosphere (12–50 km): ozone layer (absorbs UV radiation); temperature increases with altitude.
        - Mesosphere (50–80 km): coldest layer; meteors burn up here.
        - Thermosphere/Ionosphere: very thin; auroras occur here.

        Weather vs Climate:
        - Weather: short-term atmospheric conditions at a specific place and time.
        - Climate: average weather conditions over 30+ years.

        Factors affecting climate:
        - Latitude: closer to equator → warmer (more direct solar radiation).
        - Altitude: higher altitude → cooler (1°C drop per 100 m rise).
        - Distance from the sea (continentality): coastal areas have moderate temperatures; inland areas have extreme temperatures.
        - Ocean currents: warm currents raise temperatures (Mozambique/Agulhas current — SA east coast); cold currents lower temperatures (Benguela current — SA west coast). Benguela suppresses rainfall (cold water limits evaporation), creating the Namib Desert.
        - Prevailing winds: moist onshore winds bring rainfall; dry offshore winds bring drought.

        South African climate:
        - Mediterranean climate: Western Cape (wet winters, dry summers). Reason: shift of subtropical high-pressure belt.
        - Semi-arid: Northern Cape (Karoo), interior plateau.
        - Subtropical: KwaZulu-Natal coast — warm, humid, summer rainfall.
        - Highveld: Gauteng — summer thunderstorms, cold dry winters.

        Air masses and fronts:
        - Cold front: cold air mass advances under warm air mass → lifting → cloud → rain.
        - Ridging high: after a cold front passes, high pressure brings clear skies and cold nights to SA interior.
        - Cut-off low: slow-moving upper air trough causes prolonged heavy rain in SA (e.g., KZN flooding).
        """,
    },
    {
        "metadata": {"subject": "geography", "grade": 10, "topic": "geomorphology", "title": "Geomorphology — River Systems and Landforms — Grade 10 Geography", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Geomorphology is the study of landforms and the processes that shape them.

        River systems:
        A river catchment (watershed) is the area of land drained by a river and its tributaries.
        The water cycle drives river systems: evaporation → condensation → precipitation → runoff → infiltration.

        Long profile of a river — three zones:
        1. Upper course (mountain source): steep gradient, high energy, V-shaped valleys, waterfalls, rapids. Dominant process: vertical erosion (downcutting).
        2. Middle course: gentler gradient, lateral (sideways) erosion, meanders, floodplains begin to form.
        3. Lower course (mouth): lowest gradient, deposition dominant, wide floodplains, oxbow lakes, deltas.

        Erosion processes:
        - Hydraulic action: force of water against river banks.
        - Abrasion (corrasion): load scrapes and wears the channel bed and banks.
        - Attrition: particles knock against each other and break into smaller pieces.
        - Corrosion (solution): chemical weathering of soluble rocks (limestone).

        Transportation of load:
        - Traction: large boulders rolled along the bed.
        - Saltation: bouncing of smaller stones.
        - Suspension: fine particles carried within the flow.
        - Solution: dissolved minerals carried in the water.

        Deposition: occurs when the river loses energy (velocity decreases) — at the inside of meanders, where gradient flattens, at the mouth.

        Key landforms:
        - Waterfalls and gorges (upper course).
        - Meanders and oxbow lakes (middle course).
        - Floodplains, levees, and deltas (lower course).

        River flooding in SA: the Orange, Vaal, and Limpopo rivers flood seasonally.
        Human impact: dam construction (Gariep Dam on Orange River) controls flooding but disrupts ecosystems.
        """,
    },
    {
        "metadata": {"subject": "geography", "grade": 11, "topic": "climate_change", "title": "Climate Change — Causes, Impacts and Responses — Grade 11 Geography", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Climate change refers to long-term shifts in global temperatures and weather patterns, primarily driven by human activities since the Industrial Revolution.

        The greenhouse effect (natural):
        Solar radiation passes through the atmosphere and warms Earth's surface.
        Earth emits infrared radiation; greenhouse gases (GHGs) trap some of this heat → keeps Earth habitable (~15°C average).

        Enhanced greenhouse effect (human-caused):
        Burning fossil fuels (coal, oil, gas), deforestation, agriculture, and industrial processes release excess GHGs:
        - Carbon dioxide (CO₂): main GHG; from fossil fuels and deforestation.
        - Methane (CH₄): from livestock, landfills, rice paddies.
        - Nitrous oxide (N₂O): from fertilisers, livestock.
        - Chlorofluorocarbons (CFCs): from refrigerants; also deplete the ozone layer.

        Evidence of climate change:
        - Rising global average temperatures (>1.1°C above pre-industrial levels by 2023).
        - Melting polar ice caps and glaciers; rising sea levels (~3.6 mm/year).
        - More frequent extreme weather events (droughts, floods, cyclones).
        - Shifts in species distribution (phenology changes).

        Impacts on South Africa:
        - Higher temperatures (Limpopo, Northern Cape face increased heat stress).
        - Reduced winter rainfall in the Western Cape (Day Zero water crisis of 2018).
        - More intense flooding in KwaZulu-Natal.
        - Threat to agriculture, biodiversity, and water security.

        International responses:
        - Kyoto Protocol (1997): binding emission reduction targets for developed countries.
        - Paris Agreement (2015): limit global warming to 1.5°C above pre-industrial levels; NDCs (Nationally Determined Contributions) from each country.
        - South Africa's NDC: peak, plateau, and decline emissions trajectory; transition to renewable energy (solar, wind).

        Mitigation vs Adaptation:
        - Mitigation: reduce GHG emissions (renewable energy, electric vehicles, carbon taxes — SA introduced carbon tax in 2019).
        - Adaptation: adjust to inevitable changes (drought-resistant crops, sea walls, water harvesting).
        """,
    },
    {
        "metadata": {"subject": "geography", "grade": 11, "topic": "urbanisation", "title": "Settlement Geography — Urbanisation and Urban Issues — Grade 11 Geography", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Settlement geography examines where people live and why, and how settlements grow and change.

        Urbanisation: the process by which an increasing proportion of a country's population lives in urban areas (cities and towns).

        Global urbanisation trends:
        - Over 55% of the world's population lives in cities (2023); projected >70% by 2050.
        - Fastest urbanisation occurring in Asia and Sub-Saharan Africa.

        Push factors (reasons to leave rural areas): poverty, lack of services, unemployment, drought, conflict.
        Pull factors (reasons to move to cities): employment opportunities, better education and health services, infrastructure, social opportunities.

        Urbanisation in South Africa:
        - Apartheid-era influx control laws restricted Black South Africans from moving to cities.
        - Post-1994: rapid urbanisation; large informal settlements (townships) grew around cities.
        - Major metros: Johannesburg (largest), Cape Town, eThekwini (Durban), Tshwane (Pretoria), Ekurhuleni.
        - Counter-urbanisation: wealthier residents moving from city centres to suburbs or satellite towns.

        Urban settlement patterns:
        - CBD (Central Business District): highest land values; commercial, retail, offices.
        - Inner city: mixed use; often deteriorating infrastructure; gentrification in some areas.
        - Suburbs: residential; lower density; higher income toward periphery.
        - Informal settlements (shack areas): lack formal infrastructure; on-the-periphery of SA cities.

        Urban issues in SA:
        - Housing shortage: over 3 million housing backlog; government provides RDP houses (Reconstruction and Development Programme).
        - Service delivery protests: communities protest lack of water, electricity, sanitation.
        - Traffic congestion: inadequate public transport; high car ownership; Gauteng is most congested.
        - Urban heat island effect: cities are warmer than surrounding areas (dark surfaces, waste heat).
        - Crime: high in dense informal settlements; linked to inequality (Gini coefficient ~0.63).

        Smart cities: using technology (IoT, data) to improve urban management — SA piloting in Johannesburg and Cape Town.
        """,
    },
    {
        "metadata": {"subject": "geography", "grade": 12, "topic": "economic_geography", "title": "Economic Geography — Resources, Industry and Development — Grade 12 Geography", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Economic geography examines the spatial distribution of economic activities — where resources are found, where industries locate, and why.

        Classification of economic activities:
        - Primary: extraction of natural resources (mining, agriculture, fishing, forestry).
        - Secondary: manufacturing and processing (turning raw materials into products).
        - Tertiary: services (retail, banking, transport, education, healthcare).
        - Quaternary: knowledge-based services (research, ICT, financial services).
        - Quinary: highest-level decision-making (government, international organisations).

        As countries develop, they shift from primary → tertiary/quaternary (structural transformation).

        Mining in South Africa:
        - SA is one of the world's most mineral-rich countries: gold (Witwatersrand), platinum (Bushveld Igneous Complex), coal (Mpumalanga), diamonds (Kimberley), chromium, manganese.
        - Mining contributes ~7% of GDP and is a major employer (~450,000 formal jobs) and foreign exchange earner.
        - Challenges: ageing mines (deeper → higher costs), safety, labour unrest (Marikana massacre 2012), electricity supply constraints.

        Location factors for industry:
        - Raw materials: heavy industries locate near resources (Iscor steel in Vanderbijlpark — near coal/iron ore).
        - Labour: availability of skilled or cheap labour.
        - Energy supply: industries with high energy demands locate near power stations.
        - Market: perishable goods industries locate near consumers.
        - Transport and infrastructure: proximity to ports, roads, rail.
        - Government policy: Industrial Development Zones (IDZs), Special Economic Zones (SEZs).

        South Africa's Industrial Development Zones:
        - Coega IDZ (Eastern Cape): near Port Elizabeth (Gqeberha) port; attracts automotive and manufacturing investment.
        - Richards Bay IDZ: minerals processing.
        - East London IDZ: automotive (Mercedes-Benz).

        Development gap: the economic difference between developed countries (Global North) and developing countries (Global South). SA is a middle-income country but with extreme inequality.
        HDI (Human Development Index): combines life expectancy, education, and income. SA HDI ~0.71 (2023).
        """,
    },
    {
        "metadata": {"subject": "geography", "grade": 12, "topic": "gis", "title": "Geographical Information Systems (GIS) and Remote Sensing — Grade 12 Geography", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Geographic Information Systems (GIS) are computer-based tools for capturing, storing, analysing, and displaying spatial (location-based) data.

        Components of a GIS:
        - Hardware: computers, GPS units, scanners, printers, servers.
        - Software: ArcGIS, QGIS, Google Earth Engine.
        - Data: spatial data (maps, satellite images, coordinates) + attribute data (tables with information about features).
        - People: GIS analysts, urban planners, environmental scientists.
        - Methods: analysis procedures and workflows.

        Data types in GIS:
        - Vector data: points (hospitals, schools), lines (roads, rivers), polygons (provinces, land parcels). Precise locations and boundaries.
        - Raster data: grid of cells/pixels — satellite images, aerial photographs, digital elevation models (DEMs). Each cell has a value (e.g., land cover type, temperature).

        Key GIS operations:
        - Overlay analysis: combining multiple map layers to answer spatial questions (e.g., which areas are in a flood zone AND have schools?).
        - Buffer analysis: creating zones around features (e.g., 500m buffer around a river — identifies flood risk areas).
        - Network analysis: finding shortest routes (used by GPS navigation apps, emergency services).
        - Spatial query: selecting features based on location or attribute (e.g., all farms with rainfall >600mm/year).

        Remote sensing: collecting information about Earth's surface from a distance (satellites, aircraft, drones).
        - Passive sensors: detect reflected sunlight (Landsat, Sentinel satellites).
        - Active sensors: emit their own energy and measure the return (radar, LiDAR).
        Applications: land use mapping, vegetation monitoring (NDVI), flood mapping, urban growth analysis.

        Applications in South Africa:
        - CSIR and SANSA (SA National Space Agency) use satellite data for environmental monitoring, disaster management, and urban planning.
        - eNATIS (vehicle registration), property valuation systems, municipal service delivery mapping.
        - Precision agriculture: GPS-guided tractors, yield mapping, soil analysis.
        - Disaster management: flood early warning systems in KwaZulu-Natal and Limpopo.
        """,
    },
]

# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------
HISTORY: list[dict] = [
    {
        "metadata": {"subject": "history", "grade": 10, "topic": "colonialism", "title": "Scramble for Africa and Colonialism — Grade 10 History", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        The Scramble for Africa (1881–1914): the rapid colonisation of almost all of Africa by European powers.

        Background — pre-colonial Africa:
        Africa had sophisticated kingdoms and trade networks: Mali Empire, Kingdom of Kongo, Zulu Kingdom, Sokoto Caliphate, Great Zimbabwe.

        Causes of the Scramble for Africa:
        1. Economic: Industrial Revolution in Europe created demand for raw materials (rubber, ivory, minerals) and markets for manufactured goods.
        2. Strategic/Political: European nations competed for global power and prestige — colonies = power.
        3. Technological: Quinine (malaria treatment) allowed Europeans to survive in Africa; steamships and railways opened the interior; Maxim gun gave military superiority.
        4. Ideological: Social Darwinism — racist belief that Europeans were superior; "Civilising mission" used to justify colonisation.

        Berlin Conference (1884–85):
        European powers met in Berlin to divide Africa without inviting any African representatives.
        Rules: effective occupation required to claim territory; free trade in Congo Basin; anti-slavery.
        Result: Africa divided into 54 colonies with straight-line borders that ignored ethnic, linguistic, and cultural divisions.

        Colonial powers and their territories:
        - Britain: largest empire — South Africa, Egypt, Sudan, Kenya, Nigeria, Zimbabwe.
        - France: North and West Africa — Morocco, Algeria, Senegal, Mali, Ivory Coast.
        - Germany: Namibia (German South West Africa), Tanzania (German East Africa), Cameroon.
        - Belgium: Congo Free State (King Leopold II's brutal private colony).
        - Portugal: Angola, Mozambique.

        African resistance:
        - Primary resistance: armed resistance to colonial conquest (Zulu resistance at Isandlwana 1879; Battle of Adwa — Ethiopia defeated Italy 1896; Herero uprising against Germany in Namibia 1904 — first genocide of the 20th century).
        - Secondary resistance: political organisations established later (ANC founded 1912 in SA).

        Colonial impact: disrupted traditional economies, forced labour, land alienation, cultural suppression, introduction of cash economy.
        """,
    },
    {
        "metadata": {"subject": "history", "grade": 11, "topic": "world_war_1", "title": "World War I — Causes, Course and Consequences — Grade 11 History", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        World War I (1914–1918) — the first global conflict, killing an estimated 20 million people.

        Long-term causes — MAIN:
        - Militarism: European powers built large armies and navies; arms race between Britain and Germany (dreadnought battleships).
        - Alliance system: Triple Entente (Britain, France, Russia) vs Triple Alliance (Germany, Austria-Hungary, Italy). Any conflict could drag in all powers.
        - Imperialism: competition for colonies and resources created tension among European powers.
        - Nationalism: intense national pride; also minority nationalist movements (Slavic nationalism threatening Austria-Hungary).

        Immediate cause — Assassination at Sarajevo (28 June 1914):
        Archduke Franz Ferdinand (heir to Austro-Hungarian throne) assassinated by Gavrilo Princip (Serbian nationalist, Black Hand organisation) in Sarajevo, Bosnia.
        Austria-Hungary issued ultimatum to Serbia → Serbia's partial acceptance not enough → Austria-Hungary declared war → alliance system triggered chain reaction → WW1 began.

        Nature of the war:
        - Western Front: trench warfare — stalemate from 1914–1917. Battles of the Somme, Ypres, Verdun — massive casualties for small territorial gains.
        - Eastern Front: more mobile; Russia suffered catastrophic losses → Russian Revolution 1917.
        - New military technology: poison gas (first used at Ypres 1915), tanks (Battle of the Somme 1916), aircraft, machine guns, artillery barrages.
        - USA entered the war in 1917 (German unrestricted submarine warfare, Zimmermann Telegram).

        End and consequences:
        - Armistice 11 November 1918.
        - Treaty of Versailles (1919): Germany blamed for war (War Guilt Clause — Article 231); massive reparations (£6.6 billion); territorial losses (Alsace-Lorraine, Polish Corridor); military restrictions; loss of colonies.
        - New states created: Czechoslovakia, Yugoslavia, Poland.
        - League of Nations established (USA never joined).
        - Economic devastation, psychological trauma (shell shock), 1918 influenza pandemic (50 million deaths).

        South Africa and WW1: SA fought Germany in South West Africa (Namibia) and East Africa. SA troops fought in Europe (Delville Wood, Battle of the Somme — huge SA casualties). WW1 strained Afrikaner-English relations and fuelled Afrikaner nationalism.
        """,
    },
    {
        "metadata": {"subject": "history", "grade": 11, "topic": "cold_war", "title": "The Cold War — USA vs USSR — Grade 11 History", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        The Cold War (1947–1991): ideological, political, and military rivalry between the USA (capitalism/democracy) and USSR (communism/Marxism-Leninism). No direct armed conflict between the superpowers — hence "cold."

        Origins:
        - Wartime alliance of convenience (vs Nazi Germany) broke down after 1945.
        - USA dropped atomic bombs on Japan (1945) — USSR alarmed by US nuclear monopoly.
        - Iron Curtain: Soviet sphere of influence over Eastern Europe.
        - Truman Doctrine (1947): USA committed to containing communism globally.
        - Marshall Plan (1948): US economic aid to rebuild Western Europe — prevent communist appeal.
        - Berlin Blockade (1948–49): USSR blocked Western access to West Berlin; USA/UK airlifted supplies.

        Key events:
        - NATO (1949): Western military alliance. Warsaw Pact (1955): Soviet response.
        - Korean War (1950–53): USA-led UN forces vs North Korea/China. Ended in stalemate at 38th parallel.
        - Cuban Missile Crisis (1962): Soviet nuclear missiles in Cuba → 13 days of crisis → nearest the Cold War came to nuclear war. Khrushchev withdrew missiles; USA pledged not to invade Cuba.
        - Vietnam War (1955–75): US intervention against communist North Vietnam; ultimately failed. Increased domestic opposition in USA.
        - Arms race: massive nuclear arsenals; MAD (Mutually Assured Destruction) doctrine.
        - Space race: USSR (Sputnik 1957, Gagarin 1961) vs USA (Moon landing 1969).

        Détente (1970s): period of reduced tension — SALT I and II treaties limited nuclear weapons.
        Soviet invasion of Afghanistan (1979): renewed tensions; USA boycotted 1980 Moscow Olympics.

        End of the Cold War:
        - Gorbachev's reforms: Glasnost (openness) and Perestroika (restructuring) in the USSR.
        - Fall of the Berlin Wall (November 1989) — symbol of Cold War division.
        - USSR dissolved 25 December 1991 → 15 independent republics.
        - USA emerged as the sole superpower.

        Impact on Africa and South Africa:
        - USA and USSR funded proxy wars in Africa (Angola — MPLA/FNLA/UNITA backed by different superpowers; Mozambique — FRELIMO/RENAMO).
        - USA supported apartheid SA as an anti-communist ally — complicating international pressure for change.
        """,
    },
    {
        "metadata": {"subject": "history", "grade": 12, "topic": "apartheid", "title": "Apartheid — Rise, Resistance and Fall — Grade 12 History", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Apartheid (Afrikaans: "separateness") was the system of institutionalised racial segregation and discrimination enforced by the National Party (NP) government from 1948 to 1994 in South Africa.

        Rise of apartheid (1948–1960):
        - NP won the 1948 election on an apartheid platform (narrow Afrikaner nationalist victory).
        - Key apartheid laws: Population Registration Act (race classification), Group Areas Act (residential segregation), Bantu Education Act (inferior education for Black people), Suppression of Communism Act (broad powers to ban political opposition), Pass Laws (influx control — required dompas/passbook).
        - Bantustan policy (Bantustans/homelands): 13% of the country's worst land designated for 80% of the population; supposed to be "independent" states — denied SA citizenship to Black people.

        Resistance:
        - ANC (founded 1912): Defiance Campaign 1952; Freedom Charter 1955 (Kliptown); ANC Women's League march on Union Buildings 1956.
        - PAC (Pan Africanist Congress): broke from ANC 1959 on question of multiracialism.
        - Sharpeville Massacre (21 March 1960): police killed 69 unarmed protesters at PAC anti-pass law demonstration. Both ANC and PAC banned.
        - Umkhonto we Sizwe (MK): ANC's armed wing formed 1961; sabotage campaign. Rivonia Trial 1963–64 — Mandela and others sentenced to life imprisonment.
        - Steve Biko and Black Consciousness Movement (1970s): psychological liberation; Biko died in police custody 1977.
        - Soweto Uprising (16 June 1976): students protested Afrikaans as medium of instruction; hundreds killed; sparked nationwide resistance.
        - United Democratic Front (1983): broad internal anti-apartheid coalition.
        - International sanctions and boycotts: cultural, sports, economic isolation of SA.

        Transition and fall (1990–1994):
        - President F.W. de Klerk unbanned ANC/PAC/SACP and released Mandela (11 February 1990).
        - CODESA negotiations (Convention for a Democratic South Africa).
        - First democratic elections: 27 April 1994. ANC won 62.65% of vote. Mandela became first Black president.
        - Government of National Unity; Truth and Reconciliation Commission (TRC) chaired by Archbishop Desmond Tutu.
        """,
    },
    {
        "metadata": {"subject": "history", "grade": 12, "topic": "civil_rights", "title": "The Civil Rights Movement in the USA — Grade 12 History", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        The Civil Rights Movement (1954–1968): a mass social movement in the United States to end racial segregation and discrimination against African Americans, and to secure legal recognition of their citizenship rights.

        Background:
        - After the Civil War (1861–65) and abolition of slavery, Jim Crow laws enforced racial segregation in the South.
        - Plessy v Ferguson (1896): Supreme Court upheld "separate but equal" — justified segregation legally.
        - African Americans served in WW2 but returned to a segregated country — contradiction fuelled activism.

        Key events and campaigns:

        1954 — Brown v Board of Education: Supreme Court ruled racial segregation in public schools unconstitutional. Overturned Plessy.

        1955 — Montgomery Bus Boycott: Rosa Parks arrested for refusing to give up her seat. Dr Martin Luther King Jr emerged as leader. 381-day boycott ended bus segregation.

        1957 — Little Rock Crisis: National Guard used to prevent Black students from entering Central High School; President Eisenhower sent federal troops to enforce desegregation.

        1960 — Greensboro Sit-ins: Black students sat at segregated lunch counters and refused to leave; spread across the South. Student Non-violent Coordinating Committee (SNCC) formed.

        1961 — Freedom Rides: integrated groups rode interstate buses to challenge segregation in terminals. Met with violent mobs; federal government forced to enforce desegregation of interstate transport.

        1963 — Birmingham Campaign: MLK led nonviolent protests; police used fire hoses and dogs against marchers; broadcast globally. March on Washington: "I Have a Dream" speech.

        1964 — Civil Rights Act: banned discrimination based on race, colour, religion, sex, or national origin.
        1965 — Voting Rights Act: prohibited discriminatory voting practices (literacy tests). Selma to Montgomery marches (Bloody Sunday — police attacked marchers on Edmund Pettus Bridge).

        1968 — Assassination of Martin Luther King Jr (4 April, Memphis, Tennessee).

        Philosophies:
        - MLK: nonviolent direct action, civil disobedience (influenced by Gandhi).
        - Malcolm X: Black self-defence, Black nationalism, Black pride (Nation of Islam); later moderated views.
        - Black Power movement (Stokely Carmichael): Black political and cultural self-determination.

        Legacy: inspired global civil rights and anti-apartheid movements, including in South Africa.
        """,
    },
    {
        "metadata": {"subject": "history", "grade": 10, "topic": "industrial_revolution", "title": "The Industrial Revolution and Its Impact — Grade 10 History", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        The Industrial Revolution (c.1760–1840): the transition from agrarian, handicraft economies to manufacturing and industry, beginning in Britain and spreading globally.

        Origins in Britain:
        - Agricultural revolution (enclosures) freed labour for factories.
        - Britain had coal and iron ore deposits.
        - Stable government, strong banking, and financial system.
        - Growing empire provided raw materials and markets.
        - Inventions: steam engine (James Watt, improved 1769), spinning jenny (Hargreaves), water frame (Arkwright), power loom (Cartwright).

        Key features:
        - Factory system replaced cottage industries — workers moved to cities.
        - Steam power drove machinery (mills, trains, ships).
        - Railway expansion (1830s onward): transformed transport and trade.
        - Mass production: standardised goods, cheaper prices, larger volumes.

        Social consequences:
        - Urbanisation: rapid growth of industrial cities (Manchester, Birmingham, Leeds).
        - Poor working and living conditions: 12–16 hour days, child labour, dangerous factories, overcrowded slums.
        - Emergence of the working class (proletariat) and middle class (bourgeoisie).
        - Reform movements: Factory Acts (limited child labour hours), trade unions formed.
        - Karl Marx and Friedrich Engels: Communist Manifesto (1848) — argued capitalism exploits workers; called for workers' revolution.

        Global impact:
        - Spread to Western Europe, USA, Japan by late 1800s.
        - Fuelled imperialism — industrial nations needed raw materials and markets → colonisation of Africa and Asia.
        - Environmental: coal burning began large-scale atmospheric pollution.
        - The Industrial Revolution directly drove the Scramble for Africa — Belgium's need for Congo rubber, Britain's demand for SA gold and diamonds.

        Second Industrial Revolution (1870–1914): electricity (Edison, Tesla), chemicals, steel, internal combustion engine (Daimler), telephone (Bell). Transformed daily life and warfare.
        """,
    },
]

# ---------------------------------------------------------------------------
# Business Studies
# ---------------------------------------------------------------------------
BUSINESS_STUDIES: list[dict] = [
    {
        "metadata": {"subject": "business_studies", "grade": 10, "topic": "business_environments", "title": "Business Environments — PESTLE and SWOT Analysis — Grade 10 Business Studies", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        A business operates within environments that influence its performance. Understanding these environments is critical to strategy.

        The business environment has three levels:

        1. Micro environment (internal): factors the business controls.
        - Owners, management, employees, organisational culture, resources, vision, mission.
        - Mission statement: the purpose of the business. Vision statement: the desired future state.
        - Objectives: SMART (Specific, Measurable, Achievable, Realistic, Time-bound).

        2. Market environment (industry): factors the business can influence.
        - Customers, suppliers, competitors, intermediaries (retailers, distributors).
        - Porter's Five Forces: threat of new entrants, bargaining power of buyers/suppliers, threat of substitutes, competitive rivalry.

        3. Macro environment (external): factors the business CANNOT control — PESTLE:
        - Political: government stability, policy, regulation (e.g., BBBEE — Broad-Based Black Economic Empowerment in SA, Mining Charter).
        - Economic: inflation, interest rates, GDP growth, unemployment (SA's 32% unemployment rate is critical context).
        - Social: demographics, culture, attitudes, urbanisation trends.
        - Technological: innovation, automation, digitisation, e-commerce.
        - Legal: labour law (BCEA, LRA), consumer law (CPA), competition law, POPI Act.
        - Environmental: climate change regulations, carbon tax, resource scarcity.

        SWOT Analysis — evaluates the business by combining internal and external environments:
        - Strengths (internal, positive): competitive advantage, strong brand, skilled team.
        - Weaknesses (internal, negative): poor cash flow, high staff turnover, outdated technology.
        - Opportunities (external, positive): growing market, competitor failure, new technology.
        - Threats (external, negative): economic downturn, new competitors, regulation changes.

        SWOT into strategy:
        - SO strategies: use strengths to exploit opportunities.
        - WO strategies: overcome weaknesses by using opportunities.
        - ST strategies: use strengths to neutralise threats.
        - WT strategies: minimise weaknesses and avoid threats.
        """,
    },
    {
        "metadata": {"subject": "business_studies", "grade": 10, "topic": "forms_of_ownership", "title": "Forms of Business Ownership — Grade 10 Business Studies", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Choosing the right form of business ownership affects liability, control, capital raising, and taxation.

        1. Sole Trader (Sole Proprietorship):
        - One owner; simplest form; easy to establish; no separate legal entity.
        - Owner has unlimited liability — personal assets at risk for business debts.
        - All profits to owner; all losses too. Ends with death of owner.
        - Example: spaza shop, freelancer.

        2. Partnership:
        - 2–20 partners (exceptions: professional partnerships like law firms can have more).
        - Governed by a Partnership Agreement (verbal or written).
        - No separate legal entity; partners have unlimited liability (jointly and severally).
        - Partners share profits as per agreement. Dissolved if a partner leaves or dies.
        - Example: two doctors sharing a practice.

        3. Close Corporation (CC):
        - 1–10 members. Has legal personality (separate from members).
        - Members have limited liability (only to their contribution to the CC).
        - Registered with the CIPC (Companies and Intellectual Property Commission).
        - No longer possible to register new CCs under the Companies Act 71 of 2008 — existing CCs may continue.

        4. Private Company (Pty) Ltd:
        - 1–50 shareholders; shares not listed on stock exchange.
        - Separate legal entity; shareholders have limited liability.
        - Governed by Memorandum of Incorporation (MOI).
        - Directors manage the company; shareholders own it (separation of ownership and control).
        - Must be registered with CIPC. Example: most SA SMEs.

        5. Public Company (Ltd):
        - Unlimited shareholders; shares traded on the JSE (Johannesburg Stock Exchange).
        - Separate legal entity; limited liability.
        - Must publish annual financial statements (transparency to public).
        - Regulated by the Companies Act and JSE Listings Requirements.
        - Examples: Naspers, Standard Bank, Shoprite.

        6. Co-operative:
        - Voluntary association of members with common economic interests.
        - Democratic control (one member, one vote regardless of shares held).
        - Profits distributed as dividends proportional to participation.
        - Types: consumer co-ops, producer co-ops, worker co-ops.
        - SA Co-operatives Act governs these; government promotes co-ops for job creation.

        7. Non-Profit Organisation (NPO):
        - Purpose is social/public benefit, not profit.
        - Registered under NPO Act; tax-exempt status (section 18A).
        - Examples: charities, NGOs, religious organisations.
        """,
    },
    {
        "metadata": {"subject": "business_studies", "grade": 11, "topic": "human_resources", "title": "Human Resources — Recruitment, Selection and Labour Law — Grade 11 Business Studies", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Human Resource Management (HRM) involves attracting, developing, and retaining the people a business needs to achieve its objectives.

        Recruitment: finding suitable candidates for a position.
        - Internal recruitment: promoting or transferring existing employees. Cheaper; boosts morale; limits fresh ideas.
        - External recruitment: hiring from outside (job advertisements, recruitment agencies, social media, campus recruitment).
        - Job analysis: defines the job (job description) and the person needed (job specification/person specification).

        Selection process:
        Screening applications → shortlisting → interviews (structured, panel, behavioural) → psychometric testing → reference checks → job offer → induction.

        Employment equity in South Africa:
        - Employment Equity Act 55 of 1998: prohibits unfair discrimination; requires designated employers (>50 employees) to submit employment equity plans to achieve representivity (race, gender, disability).
        - Affirmative action: deliberate measures to advance previously disadvantaged groups (Black people, women, people with disabilities).

        Key South African labour legislation:
        - Basic Conditions of Employment Act (BCEA): minimum conditions — working hours (max 45/week), leave (annual: 21 days, sick leave: 30 days in 3-year cycle, maternity: 4 months unpaid), overtime pay.
        - Labour Relations Act (LRA): regulates collective bargaining, trade unions, disputes.
          - CCMA (Commission for Conciliation, Mediation and Arbitration): resolves labour disputes (unfair dismissal, unfair labour practice).
          - Dismissal must be substantively fair (valid reason) and procedurally fair (proper process — hearing, warnings).
        - Skills Development Act: levies (1% of payroll) paid to SETAs (Sector Education and Training Authorities) for workplace training.
        - National Minimum Wage Act: SA introduced a national minimum wage (R25.42/hour in 2024).
        - Occupational Health and Safety Act (OHSA): employers must provide a safe working environment.

        Training and development: on-the-job (mentoring, coaching, job rotation) vs off-the-job (workshops, e-learning, formal courses).
        Performance appraisal: evaluates employee performance against set targets; informs promotions, salary increases, training needs.
        """,
    },
    {
        "metadata": {"subject": "business_studies", "grade": 11, "topic": "marketing", "title": "Marketing — The Marketing Mix and Consumer Protection — Grade 11 Business Studies", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Marketing is the process of identifying, anticipating, and satisfying customer needs profitably.
        The marketing concept: customer satisfaction is central to business success.

        Market research: gathering and analysing data about customers, competitors, and market trends.
        - Primary research: first-hand data (surveys, interviews, focus groups, observation).
        - Secondary research: existing data (STATSSA, industry reports, government statistics).
        - Quantitative: numerical data (statistics). Qualitative: descriptive data (opinions, feelings).

        Target market: the specific group of customers a business aims to serve.
        Market segmentation: dividing a market into groups with similar characteristics:
        - Demographic: age, gender, income, education.
        - Geographic: region, urban/rural.
        - Psychographic: lifestyle, values, personality.
        - Behavioural: usage rate, brand loyalty, occasions.

        The Marketing Mix — 7Ps:
        1. Product: the goods or services offered. Features, quality, branding, packaging, product lifecycle (introduction → growth → maturity → decline).
        2. Price: what customers pay. Pricing strategies: cost-plus, competitive, penetration (low to enter), skimming (high for premium/new), psychological (R9.99).
        3. Place (distribution): getting the product to the customer. Direct (online, own stores) vs indirect (retailers, wholesalers, agents). Channel of distribution.
        4. Promotion: communicating with the market. Above-the-line (mass media — TV, radio, billboards). Below-the-line (targeted — social media, direct mail, events). POP (point of purchase) displays.
        5. People: employees who interact with customers; customer service quality.
        6. Process: the systems and procedures for delivering the service.
        7. Physical evidence: tangible proof of service quality (store layout, packaging, website).

        Consumer Protection Act 68 of 2008 (CPA):
        Protects consumers' rights in SA:
        - Right to equality and non-discrimination.
        - Right to information (clear labelling, plain language contracts).
        - Right to choose (no pressure selling).
        - Right to fair value, good quality and safety.
        - Right to disclosure and information.
        - Cooling-off period: 5 business days to cancel a direct marketing agreement.
        - Product liability: manufacturer/supplier liable for harm caused by defective products.
        """,
    },
    {
        "metadata": {"subject": "business_studies", "grade": 12, "topic": "strategies", "title": "Business Strategies — Porter's Generic Strategies and Ansoff Matrix — Grade 12 Business Studies", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Business strategy is a plan of action to achieve long-term goals and competitive advantage.

        Porter's Generic Strategies (Michael Porter, 1980):
        A business achieves competitive advantage by choosing one of three strategies:

        1. Cost Leadership:
        - Aim to be the lowest cost producer in the industry.
        - Compete on price; attract price-sensitive customers.
        - Requires: economies of scale, efficient operations, tight cost controls.
        - Risk: rivals may match costs; quality perception suffers.
        - SA examples: Shoprite (lowest-cost grocery retail), PEP Stores.

        2. Differentiation:
        - Offer unique products/services that customers value and are willing to pay a premium for.
        - Compete on quality, brand, innovation, customer service.
        - Risk: competitors imitate; premium customers are price-sensitive in downturns.
        - SA examples: Woolworths Food, Discovery Health (innovative Vitality model).

        3. Focus (Niche) Strategy:
        - Target a narrow market segment and apply either cost leadership or differentiation within that niche.
        - Cost focus: e.g., budget airline (FlySafair serving price-sensitive short-haul market).
        - Differentiation focus: e.g., Faithful to Nature (premium online organic health products).

        Ansoff Growth Matrix:
        Shows four growth strategies based on existing/new products and existing/new markets:

        1. Market Penetration (existing product + existing market): grow sales of current products to current customers. Lowest risk — advertising more, cutting prices.
        2. Market Development (existing product + new market): sell current products to new markets (new countries, new segments). E.g., SA brand expanding into Africa.
        3. Product Development (new product + existing market): develop new products for current customers. Requires R&D investment.
        4. Diversification (new product + new market): highest risk and potential reward. Related diversification (same industry) or unrelated diversification (conglomerates).

        BBBEE (Broad-Based Black Economic Empowerment):
        Transformation strategy to address apartheid-era economic exclusion.
        BBBEE scorecard measures: ownership, management control, skills development, enterprise/supplier development, socio-economic development.
        Higher BBBEE level = more empowered = preferential procurement opportunities in government tenders.
        """,
    },
    {
        "metadata": {"subject": "business_studies", "grade": 12, "topic": "corporate_governance", "title": "Corporate Governance and Business Ethics — Grade 12 Business Studies", "curriculum": "CAPS", "country": "ZA"},
        "content": """
        Corporate governance is the system of rules, practices, and processes by which a company is directed and controlled, ensuring accountability to shareholders and other stakeholders.

        King IV Report on Corporate Governance (2016):
        South Africa's King Reports are internationally recognised governance standards.
        King IV applies to all organisations and emphasises:
        - Ethical leadership: the governing body (board) should lead ethically and effectively.
        - Performance and value creation: governance must create sustainable value.
        - Adequate and effective control: risk management, internal controls, combined assurance.
        - Trust, good reputation, and legitimacy: companies must earn stakeholder trust.

        King IV principles include: the board acts as a unitary structure; independent non-executive directors; separation of roles of chairperson and CEO; audit, risk, and remuneration committees; transparency and disclosure.

        Companies Act 71 of 2008: legal framework for company governance.
        - Board of directors: responsible for overall management and strategy.
        - Shareholders: elect directors; approve major decisions at AGM (Annual General Meeting).
        - Audit committee: oversees financial reporting and internal audit.
        - Company secretary: ensures legal compliance.

        Business ethics: principles governing right and wrong conduct in business.
        Ethical business behaviour:
        - Honesty and integrity: truthful dealing with all stakeholders.
        - Fairness: equitable treatment of employees, customers, suppliers.
        - Responsibility: taking ownership of decisions and their consequences.
        - Respect: for human rights and dignity.
        - Accountability: being answerable for actions.

        Ethical dilemmas in business: whistleblowing, conflict of interest, bribery and corruption, intellectual property theft, environmental violations.

        CSR (Corporate Social Responsibility): businesses voluntarily contribute to social and environmental goals beyond legal requirements.
        Examples in SA: Sasol's community development, Standard Bank's education initiatives, MTN's rural connectivity programmes.

        Consequences of unethical business practice: legal penalties, reputational damage, loss of customers, employee morale decline, deregistration. SA context: State Capture inquiry, Steinhoff accounting scandal demonstrated catastrophic consequences of governance failures.
        """,
    },
]

# ---------------------------------------------------------------------------
# All subjects grouped for display
# ---------------------------------------------------------------------------
SUBJECT_GROUPS = [
    ("LIFE SCIENCES", LIFE_SCIENCES),
    ("ACCOUNTING", ACCOUNTING),
    ("GEOGRAPHY", GEOGRAPHY),
    ("HISTORY", HISTORY),
    ("BUSINESS STUDIES", BUSINESS_STUDIES),
]


def main() -> None:
    env_source = _load_env()
    print(f"Loaded env from: {env_source}")

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://iplliihtphnhgxqmxxdo.supabase.co").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not key:
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY is required.\nAdd it to apps/web/.env.local")
        sys.exit(1)

    supabase = create_client(url, key)
    model = SentenceTransformer("all-MiniLM-L6-v2", device="cuda")
    print(f"Model device: {model.device}\n")

    grand_total = 0
    for label, docs in SUBJECT_GROUPS:
        print(f"── {label} ({len(docs)} documents) ──")
        total = 0
        for doc in docs:
            total += ingest(supabase, model, doc["content"], doc["metadata"])
        print(f"  {label} total: {total} chunks\n")
        grand_total += total

    print(f"Done — {grand_total} total new chunks in Supabase ✅")
    print("\nVerify with SQL:")
    print("  select metadata->>'subject', count(*) from documents group by 1 order by 1;")


if __name__ == "__main__":
    main()
