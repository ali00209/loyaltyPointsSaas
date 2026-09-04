# Loyalty Points API

This guide is for trusted server-side integrations such as POS systems and
backend services. The API is currently unversioned. Configure the deployed
application origin as `BASE_URL` and call endpoints below as
`${BASE_URL}/api/...`.

## Before you start

1. Sign in to the tenant dashboard.
2. Open **Settings > API key** and generate a key.
3. Copy the key when it is shown. The raw key is displayed only once.
4. Store it in a server-side secret manager or environment variable.

Regenerating a key immediately invalidates the previous key. Never put a
tenant API key in browser JavaScript, mobile app code, source control, or
client-visible URLs. Use HTTPS in production.

## Authentication

Send the tenant key with the `Authorization` header:

```http
Authorization: Bearer loy_your_api_key
Content-Type: application/json
```

API-key authentication is supported for `POST /api/events` and the customer
endpoints documented below. For customer endpoints, the key is tenant-wide
and the request must identify the target customer with `customerEmail` or
`customerPhone`. Cookie-authenticated customer portal requests remain
supported for customer profile/data endpoints without those query parameters.
Customer signup and login are API-key-only and derive the tenant from the key;
they do not accept `slug`.

## Public program discovery

Use the program slug to retrieve public branding and status information:

```http
GET /api/public/tenants/{slug}
```

Example:

```bash
curl "$BASE_URL/api/public/tenants/acme-co"
```

Successful response:

```json
{
  "tenant": {
    "id": "tenant-uuid",
    "name": "Acme Co",
    "slug": "acme-co",
    "brandingConfig": {},
    "suspended": false
  }
}
```

Unknown slugs return `404` with `{ "error": "Program not found" }`.

## Customer endpoints

The following endpoints accept the same Bearer API key:

```http
GET /api/customer/me?customerEmail=customer%40example.com
GET /api/customer/overview?customerPhone=%2B923001234567
GET /api/customer/purchases?customerEmail=customer%40example.com
POST /api/customer/reviews?customerEmail=customer%40example.com
```

Use exactly one or both of `customerEmail` and `customerPhone`. If both are
provided, they must resolve to the same customer. Email matching is
case-insensitive. Pakistani mobile numbers may be sent as local
`03XXXXXXXXX`, international `+923XXXXXXXXX`, or `00923XXXXXXXXX`; callers
should prefer the international form.

`POST /api/customer/reviews` keeps its existing JSON body and accepts the
customer identifier in the query string:

```json
{
  "purchaseId": "purchase-event-uuid",
  "productId": "product-uuid",
  "rating": 5,
  "text": "Great product"
}
```

API-key requests apply the same tenant suspension and customer active-state
checks as portal sessions. They return `400` when no identifier or an invalid
phone is supplied, `404` when no customer matches, and `409` when a legacy
duplicate phone or conflicting email/phone pair is ambiguous.

Customer responses are tenant-scoped. The API key must never be exposed in
browser or mobile client code.

## Post an event

```http
POST /api/events
```

### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `eventType` | string | Yes | Event catalog key, such as `purchase`. |
| `payload` | object | Yes | Type-specific event data. Defaults to `{}` when omitted. |
| `eventKey` | string | No | Client-supplied idempotency key, up to 200 characters. |
| `customerId` | string | Yes for API keys | Customer ID in this tenant. |
| `customerEmail` | string | Alternative to `customerId` | Customer email in this tenant. |

For an API-key request, provide either `customerId` or `customerEmail`.
When both are provided, a matching `customerEmail` is used to resolve the
customer.

### Purchase example

`purchase` is the event type currently enabled for tenant API keys.
`orderAmount` is required and must be a non-negative number. Line items are
optional; when supplied, the array must be non-empty and each item must
include a string `productId`, a positive `quantity`, and a positive `unitPrice`.

```bash
curl -X POST "$BASE_URL/api/events" \
  -H "Authorization: Bearer $LOYALTY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "purchase",
    "customerEmail": "customer@example.com",
    "eventKey": "pos-order-10042",
    "payload": {
      "orderNumber": "10042",
      "orderAmount": 25.50,
      "items": [
        {
          "productId": "product-uuid",
          "quantity": 2,
          "unitPrice": 12.75
        }
      ]
    }
  }'
```

```javascript
const response = await fetch(`${process.env.BASE_URL}/api/events`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.LOYALTY_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    eventType: "purchase",
    customerEmail: "customer@example.com",
    eventKey: "pos-order-10042",
    payload: {
      orderNumber: "10042",
      orderAmount: 25.5,
      items: [
        { productId: "product-uuid", quantity: 2, unitPrice: 12.75 },
      ],
    },
  }),
});

const result = await response.json();
if (!response.ok) {
  throw new Error(result.error ?? "Event request failed");
}
console.log(result);
```

Successful new events return `201`:

```json
{
  "eventId": "event-uuid",
  "duplicate": false,
  "totalAwarded": 25,
  "awards": [
    {
      "ruleId": "rule-uuid",
      "ruleName": "One point per dollar",
      "points": 25
    }
  ]
}
```

If the event was already recorded, the API returns `200`:

```json
{
  "eventId": "event-uuid",
  "duplicate": true,
  "totalAwarded": 0,
  "awards": []
}
```

Points depend on the tenant's active earning rules. Clients should use the
response values rather than calculating points locally, and should ignore
unknown response fields for forward compatibility.

## Event catalog

The catalog includes these event types. Availability refers to the
authentication principal that can post the event through the current API.

| Event type | API key | Payload contract | Notes |
| --- | --- | --- | --- |
| `purchase` | Yes | `orderAmount` required; optional `orderNumber`, `itemQuantity`, `itemCount`, and non-empty `items` with `productId`, `quantity`, `unitPrice` | POS order |
| `visit` | No | Optional string `locationId` and `checkedInAt` | Customer or owner session |
| `review` | No | Required string `purchaseId`, string `productId`, numeric `rating` from 1 to 5 | Customer or owner session |
| `newsletter_signup` | No | No required fields | Customer or owner session |
| `social_share` | No | Optional string `platform` | Customer or owner session |
| `referral` | No | System-emitted | Created by referral signup flow |
| `customer_signup` | No | System-emitted | Created by customer signup flow |

Additional payload fields are preserved as JSON metadata, but only fields
used by the tenant's rules affect points. API-key integrations should use
`purchase` until support for additional API-key event types is enabled.

## Idempotency and retries

Use a stable `eventKey` from the source system, such as an order ID. Reusing
the same key within a tenant prevents duplicate points. Purchase events also
derive a deduplication key from `orderNumber` when `eventKey` is omitted.

Retry network failures and `5xx` responses with exponential backoff. Do not
blindly retry `400`, `401`, `403`, or `404` responses. A retry after an
unknown timeout should reuse the same `eventKey` and inspect `duplicate` in
the response.

## Owner checkout redemptions

The dashboard uses cookie-authenticated owner endpoints. They require the
authenticated tenant owner and never accept platform-admin sessions:

```http
POST /api/owner/redemptions/preview
POST /api/owner/redemptions/confirm
POST /api/owner/redemptions/refund
GET  /api/redemption-checkouts
```

Preview and confirm accept a tenant customer ID, a non-negative `orderAmount`
(PKR), and optional catalog line items (`productId`, `quantity`, `unitPrice`).
Preview is read-only from the checkout perspective and returns the selected
highest-priority rule, discount, eligible subtotal, points cost, remaining
balance, or a no-match/insufficient-points reason. Confirm creates an
idempotent checkout ID when one is not supplied, reserves points, and
finalizes immediately. Refunds are limited to confirmed checkouts and require
a reason; refunded points are restored to the customer.

There are currently no published rate limits, SDKs, pagination requirements,
or versioned API paths. Integrations should tolerate normal HTTP timeouts and
ignore unknown JSON fields.

## Errors

Most errors use this shape:

```json
{
  "error": "Customer not found in this program"
}
```

Common statuses for `POST /api/events`:

| Status | Meaning |
| --- | --- |
| `201` | New event accepted and points processed |
| `200` | Event was deduplicated |
| `400` | Invalid JSON, missing target customer, unknown event type, or invalid payload |
| `401` | Missing or invalid API key |
| `403` | Event type is not allowed for the authenticated principal |
| `404` | Customer does not exist in the tenant |
| `5xx` | Temporary server or database failure |

The API may return a points-engine error message in the same `{ "error": ... }`
shape. Do not treat a successful HTTP response as proof of a fixed number of
points; rule configuration controls the award.

## Customer signup

```http
POST /api/customer/signup
```

The tenant is derived from the Bearer API key; do not send `slug`.

```json
{
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "03001234567",
  "password": "secret123",
  "ref": "optional-referral-code"
}
```

`email` and `phone` are unique within a tenant. `phone` is optional and must
be a Pakistani mobile number in local or international format. A successful
signup returns `201`, awards configured signup/referral points, and sets the
`customer_token` cookie. Duplicate email or phone values return `409`.

## Customer login

```http
POST /api/customer/login
```

The tenant is derived from the Bearer API key; do not send `slug`. Provide
exactly one customer identifier:

```json
{
  "email": "customer@example.com",
  "password": "secret123"
}
```

Alternatively, use a Pakistani mobile number:

```json
{
  "phone": "+923001234567",
  "password": "secret123"
}
```

Successful login returns the customer object and sets the `customer_token`
cookie. Invalid credentials return `401`; disabled accounts and suspended
programs return `403`.
