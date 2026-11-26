-- Message body encryption rollout.
-- The API now stores messages.body as a versioned AES-256-GCM envelope:
-- smsg.v1.<iv>.<auth-tag>.<ciphertext>
-- Existing plaintext rows are migrated by the idempotent API backfill script:
--   npm run messages:encrypt-backfill -w apps/api
-- Keep the legacy column for rolling deploy compatibility; once the backfill
-- reports zero plaintext rows, the column can be renamed to body_ciphertext in
-- a later breaking migration.
DROP INDEX IF EXISTS messages_body_tsv_idx;
