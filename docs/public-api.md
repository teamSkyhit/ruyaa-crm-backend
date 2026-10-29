# Ruyaa Essentials public API

This is the contract for the storefront. It describes the API as it behaves today. Catalog content (products, categories, packs, benefits, ingredients, FAQs, banners, blogs, and site copy) is edited in the CRM and returned here.

Base URL in local development: `http://localhost:8001`

The production host will be provided separately. Do not guess it.

## Authentication

Every `/api/public` request needs the storefront key:

```
X-API-Key: <key provided by the backend team>
```

| Status | Body | Meaning |
|---|---|---|
| 401 | `{ "success": false, "error": "Missing API key" }` | Header absent |
| 401 | `{ "success": false, "error": "Invalid API key" }` | Header present but wrong |
| 503 | `{ "success": false, "error": "Public API not configured" }` | Server has no key yet |

Keep the key on the server that calls this API, or in the storefront's private environment. Do not ship it in browser JavaScript and do not commit it.

`/api/customer` does not use this key. Signed-in shoppers use the bearer token from the customer section below.

## Conventions

Most responses use:

```json
{ "success": true, "data": {} }
```

Failures use `{ "success": false, "error": "message" }` unless a section below says otherwise.

Money fields (`mrp`, `salePrice`, `price`, `compareAtPrice`, `shippingCharge`, `freeShippingThreshold`, order totals) are decimal strings such as `"399.00"`, not numbers.

The selling price of a product with no weight selected is `salePrice` when it is set, otherwise `mrp`. A selected weight uses that weight's `price`. Its struck-through price is `compareAtPrice`.

Pictures are absolute URLs. The first product picture is the cover (`image`). `images` is the gallery. Upload happens in the CRM. The storefront only displays the URLs.

Catalog `GET` responses may be cached for about 10 seconds. A hit sends `X-Cache: HIT` and `Cache-Control: public, max-age=10`. A CRM edit can take that long to appear. Checkout, payment verification, and order tracking are not cached.

| Traffic | Limit | 429 body |
|---|---|---|
| Catalog `GET`s | 3000 per minute per IP | `{ "success": false, "error": "Too many requests. Please wait a moment." }` |
| Create order, verify payment, validate discount | 10 per 15 minutes per IP | `{ "success": false, "error": "Too many orders submitted. Please wait before trying again." }` |
| Enquiry, newsletter, review | 5 per 15 minutes per IP | `{ "success": false, "error": "Too many requests. Please wait before trying again." }` |
| Order tracking | 20 per 15 minutes per IP | `{ "success": false, "error": "Too many tracking requests. Please wait before trying again." }` |

## What the product page should read

`GET /api/public/products/:slug` is the product page. Use the `slug` returned by the catalog. Do not reuse slugs from the dummy site.

| On the page | API field |
|---|---|
| Name, description | `name`, `description` |
| Cover and gallery | `image` and `images` stay in sync with product pictures. Prefer `gallery[]` for pictures and videos (`kind` is `IMAGE` or `VIDEO`, plus `url`, `thumbnailUrl`, `altText`, `sortOrder`) |
| Price before a weight is chosen | `salePrice`, otherwise `mrp`. `weight` is the default label, such as `125g` |
| Weight chips | `variants[]`. `name` is the label. `price` and `compareAtPrice` are that weight. `quantity` is its stock. `media[]` is that weight's gallery. When `usesProductGallery` is true, show `gallery` |
| Benefit cards | `benefits[]` with `title`, `description`, `image`, and `imageAlt` |
| Highlight icons | `highlights[]` with `title`, `description`, `image`, and `imageAlt` |
| Related products | `relatedProducts[]` with `id`, `name`, `slug`, `image`, `price` (`salePrice` or `mrp`), `mrp`, and `available` |
| Pack cards | `packs[]` with `title`, `subtitle`, `badge`, `image`, `price`, `compareAtPrice` |
| Ingredients | `featuredIngredients` (string array) and `fullIngredients` (text) |
| How to use, storage, shelf life | `howToUse`, `storageInstructions`, `shelfLife` |
| Manufacturer and licence | `manufacturer`, `licenceNumber` |
| FAQs on this soap | `faqs[]`. This already includes answers assigned to this product and answers assigned to every product |
| Reviews | separate call, `GET /api/public/reviews/:slug` |
| Search and social | `metaTitle`, `metaDescription`, `canonicalUrl`, `ogTitle`, `ogDescription`, `ogImage`, `imageAlt`, `robotsIndex`, `robotsFollow`. The same fields are on categories, subcategories, and blogs (`coverAlt` on a blog) |

Pack prices are their own prices. They do not change when the shopper picks a weight.

These are not in the API. Keep them as fixed text on the site:

- The claim badge, such as "100% organic / handcrafted"
- Social profiles other than Facebook, Instagram, YouTube, Pinterest, and the WhatsApp number returned by site settings

`GET /api/public/products` is the listing. It includes the SEO fields and `image` / `images`. It does not include `gallery`, `variants`, `benefits`, `highlights`, `relatedProducts`, `packs`, or `faqs`. Load the detail endpoint for a product page.

A product is listed when `isActive` is true. `showOnWebsite` is also returned. Hide a product on the storefront when `showOnWebsite` is false.

## Catalog

### Site settings

`GET /api/public/site-settings`

```json
{
  "success": true,
  "data": {
    "brandName": "Ruyaa Essentials",
    "tagline": null,
    "logoUrl": null,
    "logoAlt": null,
    "faviconUrl": null,
    "heroTitle": null,
    "heroSubtitle": null,
    "heroCTAText": null,
    "aboutTitle": null,
    "aboutText": null,
    "aboutImageUrl": null,
    "announcementBarEnabled": false,
    "announcementBarText": null,
    "announcementBarLink": null,
    "shippingCharge": "0.00",
    "freeShippingThreshold": null,
    "freeShippingEnabled": false,
    "estimatedDeliveryDays": null,
    "codEnabled": false,
    "contactEmail": null,
    "contactPhone": null,
    "whatsappNumber": null,
    "address": null,
    "socialFacebook": null,
    "socialInstagram": null,
    "socialYoutube": null,
    "socialPinterest": null,
    "metaTitle": null,
    "metaDescription": null,
    "googleAnalyticsId": null,
    "googleSearchConsoleVerification": null,
    "returnPolicy": null,
    "privacyPolicy": null,
    "termsOfService": null,
    "shippingPolicy": null
  }
}
```

`freeShippingEnabled` is true when `freeShippingThreshold` is set. Checkout still applies the threshold to the discounted subtotal. The storefront should display the charge from this payload and let order creation calculate the final charge.

`codEnabled` tells the site whether to offer cash on delivery. The order endpoint still accepts `COD` if it is sent.

### Banners

`GET /api/public/banners`

Returns active banners ordered by `sortOrder`. A banner is included when today is inside `validFrom` and `validUntil`. A missing date means that side of the window is open.

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Monsoon ritual",
      "subtitle": null,
      "imageUrl": "https://...",
      "mobileImageUrl": null,
      "ctaText": "Shop",
      "ctaUrl": "/product/shea-butter-soap",
      "isActive": true,
      "sortOrder": 0,
      "validFrom": null,
      "validUntil": null,
      "createdAt": "2026-10-27T00:00:00.000Z",
      "updatedAt": "2026-10-27T00:00:00.000Z"
    }
  ]
}
```

### Categories

`GET /api/public/categories`

Active categories, ordered by `sortOrder` then name. Each includes active subcategories in the same order. `image` and `imageAlt` are optional on both. Both also return `metaTitle`, `metaDescription`, `canonicalUrl`, `ogTitle`, `ogDescription`, `ogImage`, `robotsIndex`, and `robotsFollow`.

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Handcrafted Soaps",
      "slug": "handcrafted-soaps",
      "description": null,
      "image": null,
      "sortOrder": 1,
      "subcategories": [
        {
          "id": "uuid",
          "name": "Body",
          "slug": "body",
          "description": null,
          "image": null,
          "sortOrder": 0
        }
      ]
    }
  ]
}
```

### Product list

`GET /api/public/products`

| Query | Default | Notes |
|---|---|---|
| `page` | 1 | |
| `limit` | 20 | Maximum 100 |
| `category` | | Category slug |
| `subcategory` | | Subcategory slug |
| `search` | | Matches name or description, case-insensitive |
| `sortBy` | `newest` | Also `price_asc`, `price_desc`, `popularity`, `trending` |

`trending` ranks by units sold in the last 30 days. `popularity` ranks by units sold overall. Both fall back to newest.

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Shea Butter Soap",
      "slug": "shea-butter-soap",
      "sku": "SHEA-125",
      "sortOrder": 0,
      "mrp": "499.00",
      "salePrice": "399.00",
      "weight": "125g",
      "description": "A rich bar.",
      "featuredIngredients": ["Shea butter", "Goat milk"],
      "fullIngredients": "Shea butter, goat milk, ...",
      "shelfLife": "12 months",
      "howToUse": null,
      "storageInstructions": null,
      "manufacturer": null,
      "licenceNumber": null,
      "image": "https://...",
      "images": ["https://..."],
      "quantity": 20,
      "isActive": true,
      "showOnWebsite": true,
      "metaTitle": null,
      "metaDescription": null,
      "canonicalUrl": null,
      "ogTitle": null,
      "ogDescription": null,
      "ogImage": null,
      "imageAlt": null,
      "robotsIndex": true,
      "robotsFollow": true,
      "category": { "id": "uuid", "name": "Handcrafted Soaps", "slug": "handcrafted-soaps" },
      "subcategory": null
    }
  ],
  "pagination": { "total": 5, "page": 1, "limit": 20, "pages": 1 }
}
```

### Product detail

`GET /api/public/products/:slug`

Same product fields as the list, plus:

```json
{
  "variants": [
    {
      "id": "uuid",
      "name": "125g",
      "sku": "SHEA-125",
      "price": "399.00",
      "compareAtPrice": "499.00",
      "quantity": 20,
      "isActive": true,
      "sortOrder": 0,
      "media": [],
      "usesProductGallery": true
    }
  ],
  "gallery": [
    { "id": "uuid", "variantId": null, "kind": "IMAGE", "url": "https://...", "thumbnailUrl": null, "altText": "Shea bar", "sortOrder": 0 }
  ],
  "benefits": [
    { "id": "uuid", "title": "Deep moisture", "description": "Shea butter softens dry skin.", "image": null, "imageAlt": null, "sortOrder": 0 }
  ],
  "highlights": [
    { "id": "uuid", "title": "Cold process", "description": "Cured for weeks.", "image": null, "imageAlt": null, "sortOrder": 0 }
  ],
  "relatedProducts": [
    { "id": "uuid", "name": "Goat Milk Soap", "slug": "goat-milk-soap", "image": null, "price": "349.00", "mrp": "399.00", "available": true, "sortOrder": 0 }
  ],
  "packs": [
    {
      "id": "uuid",
      "title": "Pack of 2",
      "subtitle": "Duo Ritual",
      "badge": "Save 10%",
      "image": null,
      "price": "749.00",
      "compareAtPrice": "798.00",
      "sortOrder": 0
    }
  ],
  "faqs": [
    { "id": "uuid", "question": "Is it suitable for sensitive skin?", "answer": "Yes.", "sortOrder": 0 }
  ]
}
```

Only active weights, media, benefits, highlights, packs, and FAQs are included. A pack or FAQ with no product assignment is included on every product. Related products omit inactive products and products with `showOnWebsite` false. `available` is true when a weight has stock, or when the product has no weights and its own quantity is above zero. A video is `kind: "VIDEO"` and does not appear in `images`.

`404` `{ "success": false, "error": "Product not found" }` when the slug is missing or the product is inactive.

### FAQs

`GET /api/public/faqs`

Every active FAQ, for a help page. Each item is `{ id, question, answer, category, sortOrder, product }`. `product` is `{ id, name, slug }` or `null`. `null` means the answer is for every product. `category` is a free-text label such as `Shipping`, not a catalog category.

### Blogs

`GET /api/public/blogs?page=1&limit=12&tag=skincare`

Success is not wrapped in `success`. `limit` defaults to 12 and caps at 50. Only published posts are returned, newest `publishedAt` first.

```json
{
  "blogs": [
    {
      "id": "uuid",
      "title": "How to store a bar",
      "slug": "how-to-store-a-bar",
      "excerpt": null,
      "coverUrl": null,
      "coverAlt": null,
      "metaTitle": null,
      "metaDescription": null,
      "canonicalUrl": null,
      "ogTitle": null,
      "ogDescription": null,
      "ogImage": null,
      "robotsIndex": true,
      "robotsFollow": true,
      "tags": ["skincare"],
      "authorName": "Ruyaa Team",
      "publishedAt": "2026-10-27T00:00:00.000Z"
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 12, "totalPages": 1 }
}
```

`GET /api/public/blogs/:slug` returns that object plus `body` (HTML) directly, with no wrapper. `404` uses `{ "success": false, "error": "Blog not found" }`.

### Reviews

`GET /api/public/reviews/:productSlug`

Approved reviews only.

```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "uuid",
        "customerName": "Asha",
        "rating": 5,
        "title": "Soft skin",
        "comment": null,
        "createdAt": "2026-10-27T00:00:00.000Z"
      }
    ],
    "avgRating": 5,
    "total": 1
  }
}
```

`avgRating` is `null` when there are no approved reviews.

`POST /api/public/reviews`

A new review is saved as `PENDING`. It does not appear in the public list until the CRM approves it.

| Field | Required |
|---|---|
| `productId` | yes, product UUID from the catalog |
| `customerName` | yes |
| `customerEmail` | yes |
| `rating` | yes, integer 1 through 5 |
| `orderId` | no |
| `title` | no |
| `comment` | no |

`201` `{ "success": true, "data": { "id": "uuid", "status": "PENDING" } }`

## Checkout

### Pincode

`GET /api/public/pincode/:pincode`

`:pincode` must be 6 digits. Success is not wrapped:

```json
{
  "deliverable": true,
  "estimatedDays": 5,
  "city": "Pune",
  "state": "Maharashtra",
  "source": "zone"
}
```

`source` is `zone` when the pincode is in the CRM table, `shiprocket` when delivery was checked with the courier, or `default` when neither is available. The default response is deliverable in 7 days with `city` and `state` null. `400` `{ "success": false, "error": "Enter a 6-digit pincode" }`.

### Discount preview

`POST /api/public/discount/validate`

```json
{
  "code": "WELCOME10",
  "orderAmount": 799,
  "items": [{ "productId": "uuid" }]
}
```

`items` is required for `BOGO` and `COMBO` checks. `orderAmount` is the cart subtotal before shipping.

```json
{
  "success": true,
  "data": {
    "code": "WELCOME10",
    "type": "PERCENTAGE",
    "value": "10.00",
    "discountAmount": 80,
    "finalAmount": 719
  }
}
```

`type` is `PERCENTAGE`, `FIXED`, `BOGO`, or `COMBO`. This preview does not reserve the code. Order creation checks it again and is the source of truth.

`404` invalid or inactive code. `400` not yet active, expired, usage limit reached, minimum amount not met, free product missing, or combo products missing.

### Create order

`POST /api/public/orders`

Prices are calculated on the server. Do not send prices.

```json
{
  "customerName": "Asha Rao",
  "customerEmail": "asha@example.com",
  "customerPhone": "9876543210",
  "paymentMethod": "RAZORPAY",
  "items": [{ "productId": "uuid", "variantId": "uuid", "quantity": 1 }],
  "shippingAddress": {
    "name": "Asha Rao",
    "phone": "9876543210",
    "line1": "12 Lane",
    "line2": "",
    "city": "Pune",
    "state": "Maharashtra",
    "pincode": "411001"
  },
  "notes": "",
  "discountCode": "WELCOME10",
  "idempotencyKey": "8c2c3b1e-4f0a-4c1d-9a2e-1b7e0d5a6c11"
}
```

`paymentMethod` is `RAZORPAY` or `COD`.

If the product has any active weight, `variantId` is required. The line name stored on the order is `Product — 125g`. The unit price is the weight price. If the product has no weights, omit `variantId` and the price is `salePrice` or `mrp`.

Shipping can be the `shippingAddress` object above, the same fields at the top level (`shippingFullName`, `shippingPhone`, `shippingAddressLine1`, `shippingAddressLine2`, `shippingCity`, `shippingState`, `shippingPincode`), or `addressId` for a saved address. `addressId` requires `Authorization: Bearer <customer token>`.

Send a new UUID in `idempotencyKey` for each checkout attempt and reuse that same UUID if the request is retried. A repeat returns the original order with `200` instead of creating a second one.

Shipping is `shippingCharge` from site settings. It becomes `0` when the discounted subtotal reaches `freeShippingThreshold`.

Razorpay `201`:

```json
{
  "success": true,
  "data": {
    "order": { "id": "uuid", "orderNumber": "RE00001" },
    "razorpayOrderId": "order_abc",
    "razorpayKeyId": "rzp_test_..."
  }
}
```

Open Razorpay Checkout with `razorpayKeyId`, `razorpayOrderId`, and the amount Razorpay already has for that order. Then call verify payment. Do not mark the order paid in the browser.

COD `201`:

```json
{
  "success": true,
  "data": {
    "order": {
      "id": "uuid",
      "orderNumber": "RE00001",
      "total": "399.00",
      "status": "CONFIRMED"
    }
  }
}
```

Common `400` errors: missing field, empty items, invalid payment method, missing shipping address, inactive product, missing or unknown weight, insufficient stock, invalid discount. `401` when the customer token is bad, or when `addressId` is used without a token.

### Verify payment

`POST /api/public/orders/verify-payment`

Call this from the Razorpay success handler with the three values Razorpay returns.

```json
{
  "razorpayOrderId": "order_abc",
  "razorpayPaymentId": "pay_abc",
  "razorpaySignature": "signature"
}
```

Success moves the order to `PROCESSING` and `PAID`.

```json
{
  "success": true,
  "data": {
    "order": { "id": "uuid", "orderNumber": "RE00001", "status": "PROCESSING" }
  }
}
```

Calling it again after a successful verification returns the same success and does not charge or email again. `400` means the signature did not match. `404` means the Razorpay order id is unknown.

### Track an order

`GET /api/public/orders/track/:orderNumber`

With no `phone` or `email` query, the response is only:

```json
{ "success": true, "data": { "orderNumber": "RE00001", "status": "PROCESSING" } }
```

Add `?phone=9876543210` or `?email=asha@example.com`. The value must match the order exactly. The full response then includes `paymentStatus`, `paymentMethod`, `customerName`, `total`, `shippingFullName`, `shippingCity`, `shippingState`, `shippingPincode`, `trackingNumber`, `trackingUrl`, `courierName`, `courierStatus`, `createdAt`, `updatedAt`, and `items` of `{ productName, quantity, unitPrice, subtotal }`. Phone and email are not returned. `courierStatus` is the latest courier update, such as `DELIVERED`.

`403` when the phone or email does not match. `404` when the order number does not exist.

`status` is `PENDING_PAYMENT`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, or `REFUNDED`. `paymentStatus` is `PENDING`, `PAID`, `FAILED`, or `REFUNDED`.

## Contact

### Enquiry

`POST /api/public/enquiries`

```json
{
  "name": "Asha Rao",
  "phone": "9876543210",
  "email": "asha@example.com",
  "message": "The bar arrived cracked.",
  "productId": "uuid"
}
```

`name`, `phone`, and `message` are required. `email` and `productId` are optional. `productId` must be a real product when it is sent.

`201` `{ "success": true, "data": { "id": "uuid" } }`

### Support ticket

`POST /api/public/tickets`

```json
{
  "name": "Asha Rao",
  "phone": "9876543210",
  "email": "asha@example.com",
  "subject": "Bar arrived cracked",
  "message": "The box was open.",
  "orderNumber": "RE00001"
}
```

`name`, `phone`, `subject`, and `message` are required. `email` and `orderNumber` are optional. When `orderNumber` is sent, the phone or email must match that order.

`201` `{ "success": true, "data": { "ticketNumber": "TKT-00001" } }`

`GET /api/public/tickets/:ticketNumber` with no phone or email returns only `ticketNumber` and `status`. Add `?phone=` or `?email=` that matches the ticket to receive `subject`, `orderNumber`, and `messages`. Each message is `{ author, body, createdAt }`. `author` is `CUSTOMER` or `STAFF`.

`status` is `OPEN`, `PENDING`, or `RESOLVED`. `403` when the phone or email does not match. `404` when the ticket number does not exist.

This creates a CRM enquiry. It does not open a ticket thread and it does not email the shopper.

### Newsletter

`POST /api/public/newsletter`

```json
{ "email": "asha@example.com", "source": "footer" }
```

`200` `{ "success": true, "message": "Subscribed successfully" }`

An address that is already active returns `{ "success": true, "message": "Already subscribed" }`. `400` when the email is missing or invalid.

## Do not call from the website

`POST /api/public/webhook/razorpay` is called by Razorpay with a raw body and `X-Razorpay-Signature`. The storefront must use verify payment instead.

## Customer accounts

These routes are under `/api/customer`. They do not use `X-API-Key`. Errors are `{ "error": "message" }`, not the `success` envelope.

Send `credentials: 'include'` so the refresh cookie is stored. After login, send `Authorization: Bearer <token>` on account calls.

| Method and path | Body | Result |
|---|---|---|
| `POST /api/customer/auth/request-otp` | `{ "email" }` | `{ "message": "OTP sent to email" }` |
| `POST /api/customer/auth/verify-otp` | `{ "email", "otp" }` | `{ "token", "customer": { "id", "email", "name", "phone", "isNewUser" } }` |
| `POST /api/customer/auth/refresh` | none, cookie only | `{ "token" }` |
| `POST /api/customer/auth/logout` | none | `{ "message": "Logged out" }` |
| `GET /api/customer/me` | | `{ "id", "email", "name", "phone" }` |
| `PUT /api/customer/me` | `{ "name", "phone" }` | same shape |
| `GET /api/customer/orders` | | that customer's orders |
| `GET /api/customer/orders/:orderNumber` | | one order, only if it belongs to the customer |
| `GET /api/customer/addresses` | | array of addresses |
| `POST /api/customer/addresses` | address below | created address |
| `PUT /api/customer/addresses/:id` | address below | updated address |
| `PATCH /api/customer/addresses/:id/set-default` | | updated address |
| `DELETE /api/customer/addresses/:id` | | deleted |
| `GET /api/customer/wishlist` | | `{ id, product: { id, name, slug, price, images, inStock } }` |
| `POST /api/customer/wishlist` | `{ "productId" }` | added |
| `DELETE /api/customer/wishlist/:productId` | | removed |

`otp` is 6 digits. `isNewUser` is true until the customer has a name. OTP requests are limited to a few per hour per email.

Address body:

```json
{
  "label": "Home",
  "name": "Asha Rao",
  "phone": "9876543210",
  "line1": "12 Lane",
  "line2": "",
  "city": "Pune",
  "state": "Maharashtra",
  "pincode": "411001"
}
```

`name`, `phone`, `line1`, `city`, `state`, and `pincode` are required. The same `id` can be sent as `addressId` on `POST /api/public/orders`.

Wishlist `price` is `salePrice` or `mrp`. `images` is a one-item array of the cover. `inStock` is true when the product is active and its product-level quantity is above zero. It does not check a weight's quantity.
