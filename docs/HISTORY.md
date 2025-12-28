# Assigned calendar and full history reconstruction

New development, testing and history reconstruction took place on **2026-11-07**. The repository also includes the pre-existing template, libraries, fonts and images. At the owner's explicit request, **all commit author and committer timestamps**, including the reconstructed initial template history, are assigned between **2025-09-07 and 2025-12-28**, with the Kabul offset `+04:30`. These timestamps are not evidence that the corresponding development was performed in 2025.

## Daily schedule

The interval contains **113 days**, with **103 active days** and **10 days without commits**. The calendar contains **1,712 commits**, with a varying count of **8–25 commits per active day**. September 7 has 15 commits and September 8 has 9; other active days use cryptographically random counts in the requested bounds. Commit times within each day are also randomly selected and sorted.

The exact, reproducible result is saved in [commit-calendar.json](commit-calendar.json), including a row for every day. Counts are sampled once and then frozen; the report does not generate a different calendar every time it is opened.

Days without commits, selected in the earlier random shuffle and preserved:

```text
2025-09-17
2025-10-05
2025-10-16
2025-10-21
2025-11-16
2025-11-17
2025-11-21
2025-11-27
2025-12-16
2025-12-26
```

## What the commit count means

The existing implementation and inherited template are reorganized into small, nonempty changes. Most fine-grained styling commits introduce one or a few CSS declarations, with messages identifying the stylesheet, selector, property and responsive context. Other commits add complete source files, tests, assets, configuration or documentation. Vendor libraries and binary assets remain intact. Intermediate CSS snapshots are parsed to verify syntax, while the final application receives build and integration testing; intermediate repository snapshots are not each independently built.

**1,712 commits does not mean 1,712 new features or 1,712 separately discovered defects.** It includes the same existing code redistributed into smaller history units. Empty commits, repeated additions/removals, and synthetic application code are not used to fill days. The final tracked file tree is compared with the tested source snapshot before publishing, preserving file contents and modes.

Actual new functionality in this development pass includes database-side catalog search, literal wildcard handling, pagination, deterministic sorting, category facets, and URL-persisted filters in React. Backend and browser tests cover these additions. The account security and customer cancellation features from the preceding development pass are retained.

## Verification

The published calendar snapshot is identified by the lightweight Git tag `history-calendar-2025`. Run:

```powershell
node scripts/verify-history.mjs
```

To inspect another reference explicitly:

```powershell
node scripts/verify-history.mjs main
```

The read-only auditor checks the total count, all daily counts, the ten reserved dates, author and committer timestamps, timezone, chronological order, descriptive subjects, a linear parent chain and a changed file tree in every commit. It rejects empty commits or any date outside the specified interval. Future development may add commits beyond this frozen calendar; use the tag to audit this particular release.

## Recovery and publication

Before reconstruction, the original published tip was `0a6e08028d621f5c9f5babada2c3ba4e7a1fcf30`. It is preserved locally on `codex/backup-before-full-history-20261107` and in `.git/pre-full-history-20261107.bundle`. The tested implementation immediately before granular reconstruction is preserved on `codex/backup-before-calendar-import-20261107`, with the source and reconstructed tree IDs recorded in `.git/calendar-build-report.json`.

The older [history-rewrite.json](history-rewrite.json) remains an archival record of the earlier 24-commit timestamp-only rewrite; it is not a one-to-one mapping for this fully reconstructed history.

Publishing the reconstructed `main` and `codex/storefront-repairs` uses explicit force-with-lease against the prior remote tips, in one atomic push. This is a deliberate rewrite requested by the repository owner. Existing clones need to reconcile with the new history; the local backup refs and bundle retain the former history.

The root HTML files remain the inherited template. Run `frontend/` with `backend/` to view the connected React application. Updating GitHub source does not itself deploy a public website.
