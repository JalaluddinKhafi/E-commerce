# Customer preferences release — assigned March/April 2026 calendar

The new functionality was implemented and tested on **2026-11-08**. The repository owner requested assigned author and committer dates between **2026-03-05 and 2026-04-29**. These dates organize history; they do not claim the work was performed during those earlier months.

## Shipped functionality

- Private account wishlists, synchronized across authenticated devices.
- Explicit guest import, with no automatic merging or account-data leakage into guest storage.
- Idempotent wishlist add/remove, import deduplication, archived-item handling and a 100-product limit.
- Private delivery address CRUD, up to ten entries, with one default and automatic default reassignment after deletion.
- Saved recipient, phone and address selection during checkout, with editable fields before confirmation.
- Order recipient snapshots retained even after saved addresses are edited or removed.
- Responsive address management and contextual error/retry states.

## Assigned calendar

There are **56 calendar days**, **44 active days**, **12 reserved days off**, and **702 new commits**. Active daily counts vary between **8 and 25**. Both the days off and varying counts are selected randomly once and saved in [commit-calendar-spring-2026.json](commit-calendar-spring-2026.json). Commit times within each day are also randomized and chronologically sorted with offset `+04:30`.

The count represents small implementation fragments, individual styling properties, tests and supporting documentation—not 702 independent features. Every new commit changes the tracked tree. Existing code is not repeatedly added/removed to manufacture activity; no empty commits are used. Intermediate implementation fragments are not independently compiled. The final file tree is checked against the built and tested source snapshot.

The previous **1,712-commit** release at `cb6ee4c78668c46479cfd573c629de995997cba0` is an unchanged ancestor. The new schedule appends to it and does not rewrite the 2025 calendar. Temporary implementation commits are retained locally on a backup branch before being reorganized into the requested small fragments.

## Verification and recovery

Backend: **28 integration tests**, including account isolation, limits, invalid input, concurrent preference writes, default address promotion and order snapshot preservation. Browser: **10 end-to-end tests**, including cross-device saved products, explicit guest import, mobile address layout and checkout with a saved address. Frontend formatting and production build are also checked.

Audit this calendar with:

```powershell
node scripts/verify-spring-history.mjs
```

The default reference is the frozen tag `history-calendar-spring-2026`. Pass `main` as the argument to inspect the current branch instead. The script checks every new commit, daily counts, exactly twelve empty dates, the requested date range, author/committer equality, timezone, chronological ordering, nonempty tree changes and the unchanged earlier release tag. The earlier calendar can still be audited with `node scripts/verify-history.mjs`.

The published base is backed up locally on `codex/backup-before-spring-2026` and in `.git/pre-spring-2026.bundle`. The complete tested source before calendar reconstruction is retained on `codex/backup-before-spring-import-2026`; its tree comparison and resulting tip are recorded in `.git/spring-build-report.json`. The release is published as a normal fast-forward from the previous base.

The application uses the existing local H2 / optional PostgreSQL setup. No new external service, payment gateway or public deployment is part of this release. Previously documented Docker/PostgreSQL and legacy email verification limitations still apply.
