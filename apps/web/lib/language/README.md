# SCHOOL language layer (v1)

This is the first in-repo integration of the multilingual language layer.

## Current state
- Runs inside `apps/web`
- Exposes seed-backed API endpoints under `/api/language/*`
- Uses deterministic logic + starter seed data
- Does **not** yet persist to database tables

## Endpoints
- `POST /api/language/analyze`
- `POST /api/language/correct`
- `POST /api/language/rewrite`
- `POST /api/language/explain`
- `POST /api/language/search`
- `POST /api/language/glossary/lookup`
- `POST /api/language/feedback`
- `GET /api/language/health`

## Next integration steps
1. Replace seed-backed lookups with database-backed repositories.
2. Move glossary/correction assets into Prisma or API Postgres tables.
3. Add acceptance/rejection feedback persistence.
4. Connect SCHOOL assistant and writer UI to these routes.
5. Expand language assets beyond the ECON211/NWU seed pack.
