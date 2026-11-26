# GDE LRIP & MIP Mirror Tools

## Install dependencies

### Python
```bash
pip install -r tools/gde_mirror/requirements.txt
```

### Node
```bash
npm install --prefix tools/gde_mirror
```

## Extract links from PDF
```bash
python tools/gde_mirror/extract_pdf_links.py "/mnt/data/LRIP & MIP Digital Resources Poster (8).pdf"
```

Outputs:
- `content/gde_lrip_mip_reports/links_manifest.json`
- `content/gde_lrip_mip_reports/links.txt`

## Mirror download (single batch, resumable)
```bash
node tools/gde_mirror/mirror_download.mjs
```

Resume is automatic:
- queue stored in `content/gde_lrip_mip_reports/mirror_queue.json`
- visited stored in `content/gde_lrip_mip_reports/visited.json`

## Generate reports
```bash
node tools/gde_mirror/generate_mirror_report.mjs
```

Outputs:
- `content/gde_lrip_mip_reports/mirror_report.json`
- `content/gde_lrip_mip_reports/mirror_report.md`
- `content/gde_lrip_mip_reports/mirror_tree.txt`

## Environment variables

```bash
MIRROR_MAX_FILES=300
MIRROR_MAX_DEPTH=3
MIRROR_MAX_PAGES=200
MIRROR_TIMEOUT_MS=180000
MIRROR_MAX_ATTEMPTS=3
MIRROR_CONCURRENCY=3
```

## Troubleshooting
- **auth required / 403 / 401**: Link is not publicly accessible. The mirror will record the failure.
- **404**: Link is invalid or removed.
- **rate limited (429)**: Reduce concurrency and rerun.
- **large folders**: Increase `MIRROR_MAX_FILES` and rerun; the queue resumes.
