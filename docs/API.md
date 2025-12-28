# API contract

Base path: `/api`. JSON request/response bodies. Protected routes require `Authorization: Bearer <token>`. The frontend and API share an origin through Vite or Nginx; authentication cookies are not used.

## Routes

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness |
| POST | `/auth/register` | Public | `{name, email, password}` → `{token, user}` |
| POST | `/auth/login` | Public | `{email, password}` → `{token, user}` |
| GET | `/auth/me` | Customer | Current user, without password/hash |
| PUT | `/account/profile` | Customer | `{name}` edits only the current account's display name |
| POST | `/account/password` | Customer | `{currentPassword, newPassword}` changes credentials and revokes every old token; 204 |
| POST | `/account/logout-all` | Customer | Revoke every current token for this account; 204 |
| GET | `/products` | Public | Active products |
| GET | `/catalog` | Public | Database-filtered, paginated catalog with category facets |
| GET | `/products/{id}` | Public | Active product detail |
| GET | `/cart` | Customer | Items and current server totals |
| PUT | `/cart/{productId}` | Customer | `{quantity}` sets absolute quantity; zero removes |
| POST | `/orders` | Customer | Create order or return previous result for the same request key |
| GET | `/orders` | Customer | Only the authenticated customer's orders |
| POST | `/orders/{id}/cancel` | Customer | Cancel the current customer's PLACED order; return updated order |
| GET | `/admin/products` | Admin | Active and archived products |
| POST | `/admin/products` | Admin | Create product |
| PUT | `/admin/products/{id}` | Admin | Replace editable product fields |
| DELETE | `/admin/products/{id}` | Admin | Archive product; preserve order history |
| GET | `/admin/orders` | Admin | All orders |
| PATCH | `/admin/orders/{id}` | Admin | `{status}` changes fulfillment stage |

Registration creates only `USER` accounts. Unknown JSON properties, including injected `role` or `price`, are rejected. Email is normalized to lowercase. Passwords must be 12–72 characters and at most 72 UTF-8 bytes. JWT issuer is `freshshop`, expiration is one hour, and signing uses HS256. Set `JWT_SECRET` for a stable signing key; without it a new random development key is generated each restart.

JWTs include the account's credential `version`. Every authenticated request checks the version and role against the current account. Changing a password or calling `/account/logout-all` increments this version under an account row lock, invalidating copied tokens as well as browser sessions. Version-zero tokens without a version claim remain compatible until revoked. Missing accounts or outdated roles also fail authentication. Already-running requests are not retroactively cancelled.

Profile edits accept only `name`, up to 100 characters, trimmed and nonblank. They preserve email, password, role, cart and orders. Password changes require the current password, a different new password of 12–72 characters and at most 72 UTF-8 bytes, and return 400 for incorrect current credentials or invalid replacements. After a successful change, sign in again with the new password. These endpoints do not implement forgotten-password recovery.

## Product

### Search and pagination

`GET /api/catalog?q=carrot&category=Vegetables&sort=low&page=0&size=12` returns `{items, totalElements, totalPages, page, size, categories}`. `items` contain the same product DTOs as `/products`; `categories` include all active catalog categories, independent of current filters. Archived products are always excluded.

`q` searches name, description and category case-insensitively, up to 120 characters. `%`, `_` and backslash are treated as literal search characters. `category` is an optional case-insensitive exact category match, up to 60 characters. `sort` accepts `featured` (ID), `low`, `high`, or `name`; ties use product ID for stable pagination. `page` is zero-based, 0–100000; `size` is 1–48 (default 12). Invalid bounds or sort values return 400. Pages beyond the end return an empty item list with the actual totals.

The React storefront stores `q`, `category`, `sort` and `page` in the URL. Reloading or sharing the URL preserves filters. Changing a filter resets the page. The original `/products` array endpoint remains available for compatibility and local favorites.

```json
{
  "name": "Fresh carrots",
  "description": "Fresh from the farm",
  "category": "Vegetables",
  "image": "/images/img-pro-01.jpg",
  "priceCents": 399,
  "stock": 60,
  "active": true
}
```

Responses also contain `id`. Allowed image paths: `/images/` plus a simple filename with jpg/jpeg/png/webp extension. Image upload is not provided. Price: 1–1,000,000 cents. Stock: 0–100,000. Names: up to 120 characters, categories: 60, descriptions: 2,000.

## Cart and order

Cart responses contain `items: [{product, quantity}]`, `subtotalCents`, `shippingCents`, `totalCents`. Quantity is an integer from 0 to 99. The total limit is 100,000,000 cents before shipping. Shipping is 500 cents, waived for subtotals of at least 5,000 cents; empty carts have zero shipping.

```json
{
  "address": "Kabul, street and house number",
  "phone": "+93700000000",
  "requestKey": "caf44a97-d447-4fa3-8797-49938b665ece",
  "expectedTotalCents": 1298
}
```

`address`, `phone` and UUID `requestKey` are required. `expectedTotalCents` is optional for API clients; the React client always supplies it, and a mismatch returns 409. Totals are always recalculated from server prices. Reuse the same key when retrying an uncertain response. A previously committed order is returned before reading the now-empty cart. The key is scoped to the authenticated customer. A new order needs a new key.

Successful checkout returns 201 and the order snapshot, decrements inventory, and clears the cart in one transaction. Failure rolls back all writes. Customer row locks serialize checkout with cart writes. Product locks are acquired by ascending product ID, and existing entity state is refreshed after locking to account for concurrent purchases.

Order responses contain `id`, `createdAt`, `status`, delivery address/phone, totals, and snapshot `items: [{productId, name, image, priceCents, quantity}]`. Historic order prices and names remain unchanged when products are edited.

## Order transitions

```text
PLACED → PROCESSING → SHIPPED → DELIVERED
   └──→ CANCELLED ←──┘
```

Cancellation is allowed only from PLACED or PROCESSING and restores inventory once. Repeating the current status is a no-op. Delivered, cancelled, or shipped orders cannot be cancelled. Cash on delivery is the only payment method; no card details are accepted or stored.

The customer cancellation endpoint is stricter: it accepts only the authenticated customer's PLACED orders. A repeat on the same CANCELLED order returns the existing cancelled order without restocking again. Attempts on another customer's order return 404 without disclosing the order, while attempts after preparation starts return 409. Both customer and administrator cancellations share one lifecycle service and acquire the order lock before sorted inventory locks.

## Errors

- 400: invalid/missing fields or malformed/unknown JSON properties.
- 401: missing, invalid or expired bearer token, or incorrect login.
- 403: customer attempting an admin operation.
- 404: missing or archived public product, or missing admin order/product.
- 409: duplicate email, changed price, empty cart, insufficient inventory, or invalid order transition.

Application errors use `{ "message": "..." }`. Security-filter 401/403 responses can have no JSON body. Unexpected errors do not expose stack traces or database details.
