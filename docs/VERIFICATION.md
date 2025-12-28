# Local verification — 2026-11-07

## Passed

- `mvn -o -B -q -f backend/pom.xml verify`: 20 integration tests, zero failures/errors; executable JAR built.
- `npm run format:check`: all supported frontend source files pass.
- `npm run build`: Vite production build succeeds.
- `npm run test:e2e`: 7 Chromium browser tests pass against a running Spring Boot API with an isolated, in-memory H2 database.
- `docker compose config --quiet`: Compose configuration validates with placeholder environment values.
- `node --check js/contact-form-script.js`: legacy client script syntax passes.
- Desktop (1440 px) and mobile (390 px) storefront screenshots visually inspected. Mobile document width stays within the viewport.

## Backend coverage

1. Public catalog, missing products, and authentication on private routes.
2. Case-normalized email, BCrypt storage, successful/failed login, duplicate accounts.
3. Invalid registration and attempted role injection.
4. Cart ownership, hydrated product details, quantity limits and item removal.
5. Server-side order pricing, duplicate-request replay, cart clearing and order privacy.
6. Full inventory rollback when a later cart item is unavailable.
7. Admin authorization, invalid status transitions and exactly-once restocking on cancellation.
8. Product archival blocks purchase but allows cart removal.
9. Free-shipping threshold.
10. Changed checkout totals roll back the order; null numeric input is rejected.
11. Two customers simultaneously purchasing the final item: exactly one succeeds and stock reaches zero.
12. Profile ownership, whitespace validation and privilege injection rejection.
13. Password replacement validates current credentials and revokes every old token.
14. Account-wide sign-out revokes copied tokens while retaining the account.
15. Oversized UTF-8 login passwords return authentication failure.
16. Customer cancellation hides other customers' orders and rejects orders already being prepared.
17. Concurrent cancellation restocks an order exactly once.
18. Server-side category filtering, pagination, totals, category facets and archived product exclusion.
19. Literal searches for SQL wildcard characters.
20. Catalog request bounds and stable ordering for products with identical prices.

## Browser coverage

1. Product search, favorite storage across reload, and product details.
2. Registration, add-to-cart, quantity change, checkout, order history and empty cart after purchase.
3. Manager login, creating a product, and progressing an independently seeded order.
4. Mobile layout, desktop/mobile screenshots and missing-page handling.
5. Profile update, password replacement, old-token rejection and account-wide sign-out, including mobile account layout.
6. Customer cancellation confirmation, dismissal, final cancelled status and restored inventory.
7. Paginated catalog navigation, shared filter URLs, reload persistence and resetting the page when searching.

Browser test credentials are disposable test fixtures, not live accounts. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` was used with the preinstalled Chromium because downloading the matching browser build timed out. Screenshots and traces are generated under the ignored `frontend/test-results/` directory.

## Not verified or connected

- Docker images and the PostgreSQL runtime: Docker daemon was unavailable. Only Compose syntax was validated.
- GitHub Actions execution: workflow is provided; local results do not establish remote CI success.
- PHP execution and email delivery: PHP was unavailable locally. Legacy PHP form is separate from the new application, and mail requires explicit operator configuration.
- Online payment, delivery-provider integration, password recovery and image uploads: outside this implemented cash-on-delivery version.

The new application was tested with JDK 17, Node.js 22.16.0, Spring Boot 3.5.16 and Vite 7.3.7. Git history retains the original template commits. Development commit timestamps were subsequently reassigned at the owner's request; their actual work date and rewrite mapping are recorded in [HISTORY.md](HISTORY.md).
