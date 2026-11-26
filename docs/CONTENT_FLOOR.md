# SCHOOL Minimum Trustworthy Content Floor

SCHOOL should never imply that a subject or grade is complete merely because a route exists. The content floor measures the learner-visible curriculum at week level and distinguishes validated lesson JSON from resources-only weeks.

## Coverage states

- **Green:** at least 80% of tracked weeks have lesson JSON and at least 90% have resources.
- **Amber:** at least 50% of tracked weeks have lesson JSON and some resources exist. These pathways need explicit availability labels.
- **Red:** below the amber threshold, or no resources are present. Keep the pathway in preview/waitlist mode rather than presenting an empty lesson journey.

These defaults can be adjusted for a staged launch with `CONTENT_FLOOR_GREEN_PERCENT`, `CONTENT_FLOOR_AMBER_PERCENT`, and `CONTENT_FLOOR_RESOURCE_PERCENT`.

## Generate the report

From the repository root:

```bash
npm run content:floor
```

The command writes `content/reports/content_floor_report.md` and prints machine-readable overall coverage. To make a release check fail when the overall floor is red:

```bash
CONTENT_FLOOR_STRICT=true npm run content:floor
```

The report is evidence, not a claim of curriculum quality. A green coverage state means the expected lesson files exist; curriculum validation, language quality, assessment alignment, and accessibility still require their own checks.

Ditshego Ventures should use this report as a release-gate artifact before promoting a new grade, subject, language, or institution pathway.
