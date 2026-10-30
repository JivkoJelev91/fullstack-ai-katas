# Product Catalog Search API

**Task ID:** EXPRESS-005 · **Level:** 2 · **File:** `src/express/task5/task5.ts` · **Tests:** `npm run test:express:5`

Build a read-only product list with filters, search, sorting and pages.

## What you export

```ts
export function createApp(deps: { catalog: ProductCatalog }): Express;
```

The types `Product` and `ProductCatalog` are already in the starter file. Products come from `await deps.catalog.getAll()`. Call it on every request, and don't change the array it returns. Don't call `app.listen()`.

## The Product object

| Field        | Type     | Example                      |
| ------------ | -------- | ---------------------------- |
| `id`         | string   | `"p08"`                      |
| `name`       | string   | `"Camping Stove"`            |
| `category`   | string   | `"gear"`                     |
| `priceCents` | number   | `6999`                       |
| `rating`     | number   | `4.3`                        |
| `inStock`    | boolean  | `true`                       |
| `tags`       | string[] | `["camping", "cooking"]`     |
| `createdAt`  | string   | `"2025-10-10T10:00:00.000Z"` |

Return products exactly as the catalog gives them.

## Endpoints

| Method & path       | Success                                       |
| ------------------- | --------------------------------------------- |
| `GET /products`     | `200` + `{ "data": Product[], "pagination": {...} }` |
| `GET /products/:id` | `200` + the product                           |

## Query parameters for `GET /products`

All parameters are optional. Unknown parameters are ignored.

| Param      | Valid values                                  | Default      | What it does |
| ---------- | --------------------------------------------- | ------------ | ------------ |
| `page`     | integer ≥ 1                                   | `1`          | Which page to return |
| `pageSize` | integer 1–100                                 | `20`         | Products per page |
| `category` | any text                                      | none         | Keep products with this category (ignore upper/lower case) |
| `minPrice` | integer ≥ 0                                   | none         | Keep `priceCents >= minPrice` |
| `maxPrice` | integer ≥ 0, not less than `minPrice`         | none         | Keep `priceCents <= maxPrice` |
| `inStock`  | `true` or `false`                             | none         | Keep products with this `inStock` value |
| `q`        | any text (trimmed)                            | none         | Keep products whose `name` or one of whose `tags` contains `q` (ignore upper/lower case) |
| `sort`     | `price`, `rating`, `name`, `createdAt`, each optionally with a `-` prefix | `-createdAt` | Sort order. `-` means descending. `price` sorts by `priceCents`. `name` ignores upper/lower case. |

Steps, in order: **filter → sort → cut out the page**.

When two products are equal on the sort field, the one with the smaller `id` comes first.

**Pagination object:**

| Field        | Meaning                                         |
| ------------ | ----------------------------------------------- |
| `page`       | Current page                                    |
| `pageSize`   | Page size                                       |
| `totalItems` | Number of products that match the filters, across all pages |
| `totalPages` | `Math.ceil(totalItems / pageSize)` (`0` if nothing matches) |

A page past the end is not an error. It returns `"data": []`.

## Errors

All errors use this JSON shape:

```json
{ "error": { "code": "INVALID_QUERY", "message": "any text" } }
```

| When                                             | Status | Code            |
| ------------------------------------------------ | ------ | --------------- |
| A query parameter has an invalid value           | 400    | `INVALID_QUERY` |
| The product id does not exist                    | 404    | `NOT_FOUND`     |
| `catalog.getAll()` throws                        | 500    | `INTERNAL_ERROR` |

For a 500, don't put the original error message in the response.

## Examples

**List with defaults**

```http
GET /products

200 OK
{
  "data": [ { "id": "p09", ... }, { "id": "p04", ... }, ... ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 12, "totalPages": 1 }
}
```

**Filters, sort and page**

```http
GET /products?category=gear&inStock=true&sort=price&pageSize=2&page=2

200 OK
{
  "data": [
    { "id": "p08", "name": "Camping Stove", "category": "gear", "priceCents": 6999, "rating": 4.3,
      "inStock": true, "tags": ["camping", "cooking"], "createdAt": "2025-10-10T10:00:00.000Z" },
    { "id": "p12", "name": "Sleeping Bag", "category": "gear", "priceCents": 15999, "rating": 4.9,
      "inStock": true, "tags": ["camping", "winter"], "createdAt": "2025-09-15T10:00:00.000Z" }
  ],
  "pagination": { "page": 2, "pageSize": 2, "totalItems": 4, "totalPages": 2 }
}
```

**Search**

```http
GET /products?q=camp&sort=name

200 OK
{
  "data": [ { "id": "p08", "name": "Camping Stove", ... }, { "id": "p07", "name": "Headlamp", ... }, { "id": "p12", "name": "Sleeping Bag", ... } ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 3, "totalPages": 1 }
}
```

**One product**

```http
GET /products/p08

200 OK
{ "id": "p08", "name": "Camping Stove", "category": "gear", "priceCents": 6999, "rating": 4.3,
  "inStock": true, "tags": ["camping", "cooking"], "createdAt": "2025-10-10T10:00:00.000Z" }
```

**Errors**

```http
GET /products?pageSize=500

400 Bad Request
{ "error": { "code": "INVALID_QUERY", "message": "pageSize must be 1-100" } }
```

```http
GET /products/p99

404 Not Found
{ "error": { "code": "NOT_FOUND", "message": "Product not found" } }
```

```http
GET /products        (catalog.getAll() throws)

500 Internal Server Error
{ "error": { "code": "INTERNAL_ERROR", "message": "Something went wrong" } }
```

## Rules

- You may use any npm package.
- Edit only `task5.ts`. Do not change the tests.
