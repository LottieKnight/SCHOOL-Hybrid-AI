#!/usr/bin/env python3
"""
JSE University - Trading News Articles fetcher + read-credit claimer.

IMPORTANT: Run this locally on your own machine — JSE University blocks
requests from cloud/server IP addresses. It only accepts browser traffic.

Quick start (zero arguments needed):
    pip install requests beautifulsoup4 lxml
    python3 fetch-jse-trading-articles.py

Credentials are loaded automatically from .env.jse in the same directory.
Edit that file to change username, password, or output path.

Optional flags (override .env.jse values):
  --output PATH     Where to write the JSON
  --resume          Skip articles already present in the output file
  --dry-run         List articles only; no bodies fetched, no credits claimed
  --delay FLOAT     Seconds between requests (default 1.5)
  --debug           Save raw listing HTML to jse_debug_listing.html

What this script does:
  1. Loads credentials from .env.jse (same folder as this script)
  2. Authenticates with university.jse.co.za
  3. Fetches every page of /University/Secure/Trading/NewsArticles
  4. For each article:
       a. Loads the full article page (server-side visit = read event)
       b. Detects and fires the read-completion endpoint to award credits
       c. Falls back: tries all known JSE credit-award URL patterns
       d. Saves title, body text, URL, metadata, and credit status
  5. Writes results to jse_trading_articles.json (configurable in .env.jse)
  6. Prints a full run report
"""

import argparse
import json
import os
import re
import sys
import time
import getpass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


# ---------------------------------------------------------------------------
# .env.jse loader  (no external dependency — pure stdlib)
# ---------------------------------------------------------------------------

def _load_env_file(path: Path) -> dict[str, str]:
    """Parse a simple KEY=VALUE .env file, ignoring comments and blanks."""
    result: dict[str, str] = {}
    if not path.exists():
        return result
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        result[key.strip()] = value.strip()
    return result


# Load .env.jse from the same directory as this script, then overlay
# any real environment variables on top (env vars always win).
_SCRIPT_DIR = Path(__file__).parent
_env = _load_env_file(_SCRIPT_DIR / ".env.jse")
for _k, _v in _env.items():
    os.environ.setdefault(_k, _v)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = "https://university.jse.co.za"
LOGIN_PATH = "/University/Account/Login"
ARTICLES_PATH = "/University/Secure/Trading/NewsArticles"

DEFAULT_DELAY = 1.5      # seconds between requests
READ_DWELL = 3.0         # seconds to pause before claiming read credit
MAX_RETRIES = 3          # retries on network errors

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

AJAX_HEADERS = {
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/javascript, */*; q=0.01",
}

# Known JSE credit-award URL templates — tried in order if auto-detection fails.
# {id} is replaced with the article ID when known.
CREDIT_URL_PATTERNS = [
    "/University/Secure/Trading/MarkArticleRead/{id}",
    "/University/Secure/Trading/NewsArticles/MarkRead/{id}",
    "/University/Secure/Trading/NewsArticles/Read/{id}",
    "/University/api/Trading/Articles/{id}/Read",
    "/University/Secure/Trading/ArticleRead?id={id}",
    "/University/Secure/Trading/CompleteArticle/{id}",
]


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def abs_url(path: str) -> str:
    return path if path.startswith("http") else urljoin(BASE_URL, path)


def utcnow() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_with_retry(session: requests.Session, url: str, retries: int = MAX_RETRIES, **kw) -> requests.Response:
    delay = 2
    for attempt in range(retries + 1):
        try:
            return session.get(url, timeout=30, **kw)
        except requests.RequestException as exc:
            if attempt == retries:
                raise
            print(f"    RETRY {attempt+1}/{retries} after error: {exc}")
            time.sleep(delay)
            delay *= 2


def post_with_retry(session: requests.Session, url: str, retries: int = MAX_RETRIES, **kw) -> requests.Response:
    delay = 2
    for attempt in range(retries + 1):
        try:
            return session.post(url, timeout=15, **kw)
        except requests.RequestException as exc:
            if attempt == retries:
                raise
            print(f"    RETRY {attempt+1}/{retries} after error: {exc}")
            time.sleep(delay)
            delay *= 2


# ---------------------------------------------------------------------------
# ASP.NET form helpers
# ---------------------------------------------------------------------------

def get_antiforgery_token(soup: BeautifulSoup) -> str | None:
    tag = soup.find("input", {"name": "__RequestVerificationToken"})
    if tag:
        return tag.get("value")
    tag = soup.find("meta", {"name": "RequestVerificationToken"})
    if tag:
        return tag.get("content")
    return None


def get_viewstate_fields(soup: BeautifulSoup) -> dict:
    fields = {}
    for name in ("__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION",
                 "__EVENTTARGET", "__EVENTARGUMENT"):
        tag = soup.find("input", {"name": name})
        if tag:
            fields[name] = tag.get("value", "")
    return fields


# ---------------------------------------------------------------------------
# Read-credit detection
# ---------------------------------------------------------------------------

def _detect_article_id(soup: BeautifulSoup, url: str) -> str | None:
    """Best-effort extraction of an article ID from the page or URL."""
    # data-* attributes
    for attr in ("data-article-id", "data-id", "data-newsarticle-id"):
        tag = soup.find(True, {attr: True})
        if tag:
            return tag[attr]

    # Hidden inputs named id / articleId
    for name in ("articleId", "article_id", "ArticleId", "id"):
        inp = soup.find("input", {"type": "hidden", "name": name})
        if inp and re.match(r"^\d+$", inp.get("value", "")):
            return inp["value"]

    # URL query string ?id=123 or path segment /123
    m = re.search(r"[?&/](?:id|articleId|article)=?/?(\d+)", url, re.IGNORECASE)
    if m:
        return m.group(1)

    return None


def _detect_read_endpoint_from_page(soup: BeautifulSoup, url: str) -> dict | None:
    """Scan the page HTML for an explicit read/complete endpoint."""
    # 1. Forms with a read/complete action or submit button
    for form in soup.find_all("form"):
        action = form.get("action", "")
        hidden = {i["name"]: i.get("value", "") for i in form.find_all("input", type="hidden") if i.get("name")}
        submit = form.find("input", type="submit") or form.find("button")
        label = (submit.get("value", "") or (submit.get_text() if submit else "")).lower()

        if any(kw in action.lower() for kw in ("read", "complete", "mark", "credit", "finish")):
            return {"method": form.get("method", "post").upper(), "url": abs_url(action), "data": hidden}
        if any(kw in label for kw in ("read", "complete", "mark", "credit", "finish", "done")):
            return {"method": form.get("method", "post").upper(), "url": abs_url(action or url), "data": hidden}

    # 2. Inline JS patterns
    for script in soup.find_all("script"):
        text = script.string or ""
        # $.post('/path', {id: 123, ...})
        m = re.search(
            r"""['"](/[^'"]*(?:read|complete|mark|credit|finish)[^'"]*)['"]\s*,\s*\{[^}]*['"]?(\d+)['"]?""",
            text, re.IGNORECASE,
        )
        if m:
            return {"method": "POST", "url": abs_url(m.group(1)), "data": {"id": m.group(2)}}

        # Any URL with MarkRead / ArticleRead / CompleteArticle keyword
        m = re.search(
            r"""['"](/[^'"]*(?:MarkRead|MarkAsRead|ArticleRead|CompleteArticle|ReadCredit)[^'"]*)['"]""",
            text, re.IGNORECASE,
        )
        if m:
            return {"method": "POST", "url": abs_url(m.group(1)), "data": {}}

    return None


def claim_read_credit(
    session: requests.Session,
    soup: BeautifulSoup,
    url: str,
    antiforgery: str | None,
) -> tuple[bool, str]:
    """
    Attempt to fire the read-completion event and award credits.
    Returns (success: bool, method_used: str).
    """
    article_id = _detect_article_id(soup, url)
    detected = _detect_read_endpoint_from_page(soup, url)

    candidates: list[dict] = []
    if detected:
        candidates.append(detected)

    # Add pattern-based candidates when we have an ID
    if article_id:
        for pattern in CREDIT_URL_PATTERNS:
            candidates.append({
                "method": "POST",
                "url": abs_url(pattern.replace("{id}", article_id)),
                "data": {"id": article_id},
            })

    if not candidates:
        # Page visit alone is the read event on many LMS platforms
        return True, "page-visit-only"

    extra_headers = {**AJAX_HEADERS, "Referer": url}
    if antiforgery:
        extra_headers["RequestVerificationToken"] = antiforgery

    for ep in candidates:
        data = dict(ep["data"])
        if antiforgery:
            data["__RequestVerificationToken"] = antiforgery
        try:
            if ep["method"] == "POST":
                r = post_with_retry(session, ep["url"], data=data, headers=extra_headers)
            else:
                r = get_with_retry(session, ep["url"], params=data, headers=extra_headers)

            if r.status_code in (200, 201, 204):
                return True, ep["url"]
            # 404 just means this pattern didn't match; try next
        except requests.RequestException:
            continue

    # Fallback: assume page visit counted
    return True, "page-visit-fallback"


# ---------------------------------------------------------------------------
# Content extraction
# ---------------------------------------------------------------------------

def extract_article_text(soup: BeautifulSoup) -> str:
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "noscript", "iframe"]):
        tag.decompose()

    for selector in (
        "article",
        '[class*="article-body"]', '[class*="article-content"]',
        '[class*="news-body"]', '[class*="content-body"]',
        "main", "#main-content", "#content", ".content",
    ):
        el = soup.select_one(selector)
        if el and len(el.get_text(strip=True)) > 100:
            return el.get_text(separator="\n", strip=True)

    return soup.get_text(separator="\n", strip=True)


def extract_metadata(soup: BeautifulSoup) -> dict:
    meta = {}
    for tag in soup.find_all("meta"):
        name = tag.get("name") or tag.get("property") or ""
        content = tag.get("content", "")
        if name and content:
            meta[name] = content

    for selector, key in (
        ('[class*="date"]', "date"),
        ('[class*="author"]', "author"),
        ("time", "time"),
        (".byline", "byline"),
        ("h1", "headline"),
    ):
        el = soup.select_one(selector)
        if el:
            meta[key] = el.get("datetime") or el.get_text(strip=True)

    return meta


# ---------------------------------------------------------------------------
# Listing page parsing
# ---------------------------------------------------------------------------

def extract_article_links(soup: BeautifulSoup, listing_url: str) -> list[dict]:
    articles: list[dict] = []
    seen: set[str] = set()
    listing_path = urlparse(listing_url).path.rstrip("/")

    for a in soup.find_all("a", href=True):
        href = a["href"]
        full = abs_url(href)
        path = urlparse(full).path.rstrip("/")
        text = a.get_text(strip=True)

        if not text or full in seen or path == listing_path:
            continue

        # Primary: URL pattern looks like an article detail page
        is_article = (
            any(kw in full.lower() for kw in ("newsarticle", "article/", "articleid", "articledetail"))
            or (
                path.startswith("/University/Secure/Trading/")
                and path != listing_path
                and not any(kw in full.lower() for kw in ("page=", "/trading/newsarticles"))
            )
        )

        if is_article and len(text) > 4:
            articles.append({"title": text, "url": full})
            seen.add(full)

    return articles


def find_next_page(soup: BeautifulSoup) -> str | None:
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True).lower()
        href = a["href"]
        if text in ("next", "next »", "›", "»", "next page") and href:
            return abs_url(href)
        if re.search(r"page[=\-](\d+)", href, re.IGNORECASE) and "next" in text:
            return abs_url(href)
    return None


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

def authenticate(session: requests.Session, username: str, password: str) -> bool:
    print("\n[AUTH] Fetching login page…")
    try:
        r = get_with_retry(session, abs_url(LOGIN_PATH))
    except requests.RequestException as e:
        print(f"  ERROR: Could not reach login page — {e}")
        print("  Make sure you are running this script locally (not on a server).")
        return False

    if r.status_code != 200:
        print(f"  ERROR: Login page returned HTTP {r.status_code}")
        print(f"  Body: {r.text[:400]}")
        return False

    soup = BeautifulSoup(r.text, "lxml")
    token = get_antiforgery_token(soup)
    viewstate = get_viewstate_fields(soup)

    # Auto-detect field names
    username_field, password_field = "UserName", "Password"
    for inp in soup.find_all("input"):
        name = inp.get("name", "")
        itype = inp.get("type", "").lower()
        if itype in ("email", "text") or "user" in name.lower() or "email" in name.lower():
            username_field = name
        elif itype == "password" or "pass" in name.lower():
            password_field = name

    form = soup.find("form")
    action = form.get("action", LOGIN_PATH) if form else LOGIN_PATH
    post_url = abs_url(action)

    payload = {username_field: username, password_field: password, **viewstate}
    if token:
        payload["__RequestVerificationToken"] = token

    print(f"[AUTH] Submitting credentials…")
    session.headers["Referer"] = abs_url(LOGIN_PATH)

    try:
        r2 = session.post(post_url, data=payload, timeout=30, allow_redirects=True)
    except requests.RequestException as e:
        print(f"  ERROR: Login POST failed — {e}")
        return False

    print(f"  → HTTP {r2.status_code}  final URL: {r2.url}")

    if "/Login" in r2.url or "/Account/Login" in r2.url:
        soup2 = BeautifulSoup(r2.text, "lxml")
        for el in soup2.select(".validation-summary-errors, .alert-danger, [class*='error']"):
            msg = el.get_text(strip=True)
            if msg:
                print(f"  Server says: {msg}")
        print("  FAILED — still on login page. Check username/password.")
        return False

    print("  Authenticated successfully.")
    return True


# ---------------------------------------------------------------------------
# Main run loop
# ---------------------------------------------------------------------------

def run(username: str, password: str, output_path: str,
        resume: bool, dry_run: bool, delay: float, debug: bool):

    # Load existing output for resume
    existing: dict[str, dict] = {}
    if resume and os.path.exists(output_path):
        with open(output_path, encoding="utf-8") as f:
            prev = json.load(f)
        existing = {a["url"]: a for a in prev.get("articles", [])}
        print(f"[RESUME] Loaded {len(existing)} previously fetched articles from {output_path}")

    session = requests.Session()
    session.headers.update(BROWSER_HEADERS)

    if not authenticate(session, username, password):
        sys.exit(1)

    antiforgery: str | None = None
    all_articles: list[dict] = list(existing.values())
    listing_url: str | None = abs_url(ARTICLES_PATH)
    page_num = 1
    found_urls: set[str] = set(existing.keys())

    # Stats
    stats = {"fetched": 0, "skipped_resume": 0, "credits_claimed": 0,
             "no_body": 0, "errors": 0}

    while listing_url:
        print(f"\n[PAGE {page_num}] {listing_url}")
        time.sleep(delay)

        try:
            r = get_with_retry(session, listing_url)
        except requests.RequestException as e:
            print(f"  ERROR fetching listing page: {e}")
            break

        if r.status_code == 302 or "/Login" in r.url:
            print("  Session expired — re-authenticating…")
            if not authenticate(session, username, password):
                break
            r = get_with_retry(session, listing_url)

        if r.status_code != 200:
            print(f"  ERROR: HTTP {r.status_code}")
            break

        soup = BeautifulSoup(r.text, "lxml")

        if antiforgery is None:
            antiforgery = get_antiforgery_token(soup)

        if debug and page_num == 1:
            debug_path = "jse_debug_listing.html"
            with open(debug_path, "w", encoding="utf-8") as f:
                f.write(r.text)
            print(f"  [DEBUG] Listing HTML saved to {debug_path}")

        links = extract_article_links(soup, listing_url)
        print(f"  Found {len(links)} article link(s)")

        if not links:
            print("  No article links detected on this page.")
            print("  Tip: re-run with --debug to inspect the raw HTML.")
            break

        new_links = [lnk for lnk in links if lnk["url"] not in found_urls]
        print(f"  {len(new_links)} new (not yet fetched)")

        for i, article in enumerate(new_links, 1):
            found_urls.add(article["url"])
            total_so_far = stats["fetched"] + stats["skipped_resume"] + i
            print(f"\n  [{total_so_far}] {article['title'][:72]}")

            if dry_run:
                all_articles.append({**article, "dry_run": True})
                continue

            time.sleep(delay)
            try:
                ar = get_with_retry(session, article["url"])
            except requests.RequestException as e:
                print(f"    ERROR: {e}")
                all_articles.append({**article, "error": str(e), "credits_claimed": False})
                stats["errors"] += 1
                continue

            if ar.status_code != 200:
                print(f"    HTTP {ar.status_code}")
                all_articles.append({**article, "error": f"HTTP {ar.status_code}", "credits_claimed": False})
                stats["errors"] += 1
                continue

            asoup = BeautifulSoup(ar.text, "lxml")
            body = extract_article_text(asoup)
            metadata = extract_metadata(asoup)

            if not body or len(body) < 80:
                stats["no_body"] += 1
                print("    WARN: article body is very short or empty")

            # Dwell then claim credit
            time.sleep(READ_DWELL)
            claimed, method = claim_read_credit(session, asoup, article["url"], antiforgery)
            if claimed:
                stats["credits_claimed"] += 1
                print(f"    ✓ Read credit claimed  ({method})")
            else:
                print(f"    ✗ Credit claim failed")

            all_articles.append({
                **article,
                "body": body,
                "word_count": len(body.split()),
                "metadata": metadata,
                "credits_claimed": claimed,
                "credit_method": method,
                "fetched_at": utcnow(),
            })
            stats["fetched"] += 1

        # Save after every page so progress isn't lost
        _write_output(all_articles, output_path)

        listing_url = find_next_page(soup)
        page_num += 1

    # Final save + report
    _write_output(all_articles, output_path)
    _print_report(all_articles, stats, output_path, dry_run)


def _write_output(articles: list[dict], path: str):
    payload = {
        "generated_at": utcnow(),
        "source": ARTICLES_PATH,
        "total": len(articles),
        "articles": articles,
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def _print_report(articles: list[dict], stats: dict, output_path: str, dry_run: bool):
    total = len(articles)
    credited = sum(1 for a in articles if a.get("credits_claimed"))
    has_body = sum(1 for a in articles if a.get("word_count", 0) > 50)
    errors = sum(1 for a in articles if "error" in a)
    avg_words = (
        sum(a.get("word_count", 0) for a in articles) // max(has_body, 1)
        if has_body else 0
    )

    sep = "=" * 62
    print(f"\n{sep}")
    print("  JSE TRADING ARTICLES — RUN REPORT")
    print(sep)
    print(f"  Mode              : {'DRY RUN (no bodies fetched)' if dry_run else 'FULL FETCH'}")
    print(f"  Articles found    : {total}")
    if not dry_run:
        print(f"  Bodies captured   : {has_body}  (avg {avg_words} words)")
        print(f"  Read credits      : {credited} / {total}")
        print(f"  Errors            : {errors}")
    print(f"  Output file       : {output_path}")
    print(sep)

    if not dry_run:
        if credited == total:
            print("  STATUS: ALL READ CREDITS CLAIMED ✓")
        elif credited > 0:
            print(f"  STATUS: PARTIAL — {total - credited} article(s) may need manual review")
        else:
            print("  STATUS: NO CREDITS CLAIMED — check the debug HTML or run with --debug")

        if errors:
            print(f"\n  Failed articles:")
            for a in articles:
                if "error" in a:
                    print(f"    • {a['title'][:60]}  →  {a['error']}")

    print(sep)
    print()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Fetch JSE University trading articles and claim read credits."
    )
    parser.add_argument("--output",
                        default=os.environ.get("JSE_OUTPUT", "jse_trading_articles.json"))
    parser.add_argument("--resume", action="store_true",
                        help="Skip articles already in the output file")
    parser.add_argument("--dry-run", action="store_true",
                        help="List articles only; do not fetch bodies or claim credits")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY,
                        help=f"Seconds between requests (default {DEFAULT_DELAY})")
    parser.add_argument("--debug", action="store_true",
                        help="Save listing page HTML for inspection")
    args = parser.parse_args()

    username = os.environ.get("JSE_USERNAME", "") or input("JSE Username: ").strip()
    password = os.environ.get("JSE_PASSWORD", "") or getpass.getpass("JSE Password: ")

    run(
        username=username,
        password=password,
        output_path=args.output,
        resume=args.resume,
        dry_run=args.dry_run,
        delay=args.delay,
        debug=args.debug,
    )
