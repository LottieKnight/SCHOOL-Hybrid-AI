"""
SCHOOL RAG Ingestion Pipeline
Chunks text, embeds on GPU, inserts into Supabase documents table.

Usage (from repo root):
  source ~/gpu-env/bin/activate
  python scripts/ingest.py

Env vars (from apps/web/.env.local or shell environment):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from supabase import create_client


def _load_env() -> str:
    # Load all env files — later files override earlier ones.
    # apps/web/.env.local is authoritative for RAG credentials.
    loaded = []
    for candidate in [
        Path(".env.local"),
        Path("apps/web/.env.local"),
        Path(__file__).parent.parent / "apps/web/.env.local",
    ]:
        if candidate.exists() and str(candidate.resolve()) not in [str(p.resolve()) for p in loaded]:
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


def ingest(
    supabase,
    model: SentenceTransformer,
    content: str,
    metadata: dict,
    batch_size: int = 32,
) -> int:
    chunks = chunk_text(content)
    if not chunks:
        return 0

    title = metadata.get("title", "unknown")
    print(f"  Embedding {len(chunks)} chunks for: {title}")
    embeddings = model.encode(chunks, batch_size=batch_size, show_progress_bar=True)

    rows = [
        {"content": chunk, "embedding": emb.tolist(), "metadata": metadata}
        for chunk, emb in zip(chunks, embeddings)
    ]

    result = supabase.table("documents").insert(rows).execute()
    count = len(result.data) if result.data else 0
    print(f"  Inserted {count} rows ✅")
    return count


# ---------------------------------------------------------------------------
# CAPS seed documents — Economics Grade 10 initial set
# Add more entries here or call ingest() from other scripts for bulk loading.
# ---------------------------------------------------------------------------
SEED_DOCUMENTS: list[dict] = [
    {
        "metadata": {
            "subject": "economics",
            "grade": 10,
            "topic": "macroeconomics",
            "subtopic": "gdp_gnp",
            "title": "GDP and GNP — Grade 10 Economics",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        Gross Domestic Product (GDP) is the total monetary value of all final goods and
        services produced within a country's borders during a specific time period, usually
        a year or a quarter. GDP measures the size and health of an economy.

        Three methods to calculate GDP:

        1. Expenditure approach: GDP = C + I + G + (X - M)
           C = household consumption, I = investment, G = government spending,
           X = exports, M = imports. (X minus M) is net exports.

        2. Income approach: sum of all incomes earned producing goods and services —
           wages, profits, rents, interest.

        3. Production (value-added) approach: sum of value added at each stage across
           all sectors of the economy.

        Gross National Product (GNP) differs from GDP. GNP measures output by a
        country's residents regardless of where they are located, while GDP measures
        output within the country's borders.
        GNP = GDP + income earned abroad by SA residents - income earned in SA by foreigners.

        In South Africa, GDP is measured quarterly by Statistics South Africa (Stats SA).
        Key GDP sectors: mining, manufacturing, finance, retail/trade, government services.

        Real GDP adjusts for inflation using a base year price level.
        Nominal GDP uses current year prices.
        GDP per capita = GDP divided by population — measures average living standards.
        South Africa's GDP per capita (~R90 000 in nominal terms) hides high inequality
        measured by the Gini coefficient (among the highest in the world at ~0.63).
        """,
    },
    {
        "metadata": {
            "subject": "economics",
            "grade": 10,
            "topic": "macroeconomics",
            "subtopic": "business_cycle",
            "title": "Business Cycle — Grade 10 Economics",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        The Business Cycle describes the recurring fluctuations in economic activity over time.

        Four phases:
        1. Expansion (Upswing): GDP rises, employment increases, consumer spending grows,
           business investment picks up, inflation may begin to rise.
        2. Peak: the highest point of economic activity before a downturn begins.
           Output and employment are at or near maximum levels.
        3. Contraction (Downswing / Recession): GDP declines for at least two consecutive
           quarters. Unemployment rises, spending falls, business profits shrink.
        4. Trough: the lowest point of the cycle before recovery begins.

        The South African Reserve Bank (SARB) monitors business cycle phases and publishes
        composite leading, coincident, and lagging indicators to track where the economy is.

        Policy responses:
        Fiscal policy (government budget): expansionary = increase spending or cut taxes;
        contractionary = reduce spending or raise taxes.

        Monetary policy (SARB): expansionary = cut repo rate to stimulate borrowing;
        contractionary = raise repo rate to cool inflation.

        South Africa has experienced several recession cycles, often linked to mining strikes,
        electricity supply constraints (load shedding), and global commodity price shocks.
        """,
    },
    {
        "metadata": {
            "subject": "economics",
            "grade": 10,
            "topic": "macroeconomics",
            "subtopic": "inflation",
            "title": "Inflation and CPI — Grade 10 Economics",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        Inflation is a sustained increase in the general price level of goods and services,
        which reduces the purchasing power of money over time.

        Measurement: Stats SA publishes monthly Consumer Price Index (CPI) figures.
        CPI measures price changes in a basket of goods and services that a typical
        South African household buys.

        The SARB's inflation target band is 3% to 6% per year.

        Types of inflation:
        - Demand-pull: excess demand in the economy pushes prices up (too much money
          chasing too few goods).
        - Cost-push: rising production costs (wages, oil prices, electricity tariffs)
          push prices up — very relevant in SA due to Eskom price increases.
        - Built-in (wage-price spiral): workers demand higher wages as prices rise,
          which raises costs, which raises prices further.

        Effects of inflation:
        - Erodes purchasing power — your money buys less over time.
        - Hurts people on fixed incomes (pensioners, grant recipients).
        - Benefits borrowers — debt becomes cheaper in real terms.
        - Harms savers — real value of savings falls.
        - Creates economic uncertainty and discourages investment.

        SARB monetary policy response:
        Raising the repo rate increases borrowing costs, reducing consumer spending
        and business investment, which lowers inflationary pressure.
        The prime lending rate = repo rate + 3.5 percentage points.
        """,
    },
    {
        "metadata": {
            "subject": "economics",
            "grade": 10,
            "topic": "microeconomics",
            "subtopic": "supply_demand",
            "title": "Supply and Demand — Grade 10 Economics",
            "curriculum": "CAPS",
            "country": "ZA",
        },
        "content": """
        Supply and Demand — the foundation of microeconomics.

        Law of Demand: as price rises, quantity demanded falls (inverse relationship),
        ceteris paribus (all else equal). The demand curve slopes downward left to right.

        Non-price factors that shift the demand curve (change in demand):
        - Income: for normal goods, demand rises with income; for inferior goods, falls.
        - Prices of related goods: substitutes (e.g. butter vs margarine), complements
          (e.g. cars and petrol).
        - Consumer tastes and preferences.
        - Expectations about future prices.
        - Population size and demographics.

        Law of Supply: as price rises, quantity supplied rises (direct relationship),
        ceteris paribus. The supply curve slopes upward.

        Non-price factors that shift the supply curve:
        - Input/production costs (e.g. electricity price increases via Eskom tariffs
          shift supply left for SA manufacturers).
        - Technology improvements.
        - Number of producers in the market.
        - Government taxes (shift left) and subsidies (shift right).
        - Weather conditions (critical for SA agricultural commodities).

        Market Equilibrium: price at which quantity demanded equals quantity supplied.
        - Excess demand (shortage): price rises, quantity demanded falls, quantity supplied
          rises until equilibrium is restored.
        - Excess supply (surplus): price falls until equilibrium is restored.

        Price Elasticity of Demand (PED):
        PED = % change in quantity demanded / % change in price.
        PED > 1: elastic (luxury goods). PED < 1: inelastic (necessities like bread, water).
        """,
    },
]


def main() -> None:
    env_source = _load_env()
    print(f"Loaded env from: {env_source}")

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://iplliihtphnhgxqmxxdo.supabase.co").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not key:
        print(
            "ERROR: SUPABASE_SERVICE_ROLE_KEY is required for writes.\n"
            "Get it from: Supabase → Project Settings → API → service_role secret\n"
            "Then add it to apps/web/.env.local"
        )
        sys.exit(1)

    supabase = create_client(url, key)
    model = SentenceTransformer("all-MiniLM-L6-v2", device="cuda")
    print(f"Model device: {model.device}\n")

    total = 0
    for doc in SEED_DOCUMENTS:
        total += ingest(supabase, model, doc["content"], doc["metadata"])

    print(f"\nDone — {total} total chunks in Supabase ✅")
    print("\nVerify with SQL:\n  select metadata->>'title', count(*) from documents group by 1;")


if __name__ == "__main__":
    main()
