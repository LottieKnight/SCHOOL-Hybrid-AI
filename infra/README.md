## Infrastructure Notes

### CDN + Cache Strategy
- Serve static assets with `Cache-Control: public, max-age=31536000, immutable`.
- Cache SSR/SSG HTML at the edge with short TTL (e.g., 1-5 minutes) and revalidate on deploy.
- Use Cloudflare cache rules to bypass API routes.

### Object Storage
- Media files should be stored in S3-compatible storage (AWS S3/Cloudflare R2/MinIO).
- The API should generate signed URLs for uploads and temporary access.

### Environment Variables
- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `SENTRY_DSN`.
