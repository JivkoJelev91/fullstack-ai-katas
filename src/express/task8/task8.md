# Paginate Products

**Task ID:** EXPRESS-008 · **Level:** 1 · **File:** `src/express/task8/task8.ts` · **Tests:** `npm run test:express:8`

Build one endpoint: `GET /products?page=2&pageSize=3` returns one page of products plus information about the pages.

`createApp(initialProducts)` receives the products the app starts with. The starter already puts them into the `products` array. You write the handler.

The `Product` object is the same as in EXPRESS-005. The examples use an app started with 8 products, `p1` … `p8`.

## GET /products

**REQUIREMENT:**

- `page`: which page to return. A whole number `>= 1`. Default `1`.
- `pageSize`: how many products per page. A whole number from `1` to `50`. Default `5`.
- Return `200` with the products of that page (in the order they were added) and a `pagination` object:

| Field | Meaning |
| --- | --- |
| `page` | The current page |
| `pageSize` | The page size |
| `totalItems` | How many products there are in total |
| `totalPages` | `Math.ceil(totalItems / pageSize)` (`0` when there are no products) |

- A page after the last one is not an error: return `"data": []`.
- If `page` or `pageSize` is invalid, return `400` with `{ "error": "<any message>" }`.

Page 2 with page size 3 starts at index `(2 - 1) * 3 = 3`. `products.slice(3, 6)` returns the items at index 3, 4 and 5.

**INPUT:** no parameters

```http
GET /products
```

**OUTPUT:** page 1, 5 per page

```http
200 OK
{ "data": [ p1, p2, p3, p4, p5 ],
  "pagination": { "page": 1, "pageSize": 5, "totalItems": 8, "totalPages": 2 } }
```

**INPUT:**

```http
GET /products?page=2&pageSize=3
```

**OUTPUT:**

```http
200 OK
{ "data": [ p4, p5, p6 ],
  "pagination": { "page": 2, "pageSize": 3, "totalItems": 8, "totalPages": 3 } }
```

**INPUT:** the last page can be shorter

```http
GET /products?page=2
```

**OUTPUT:**

```http
200 OK
{ "data": [ p6, p7, p8 ],
  "pagination": { "page": 2, "pageSize": 5, "totalItems": 8, "totalPages": 2 } }
```

**INPUT:** after the last page

```http
GET /products?page=3
```

**OUTPUT:**

```http
200 OK
{ "data": [],
  "pagination": { "page": 3, "pageSize": 5, "totalItems": 8, "totalPages": 2 } }
```

**Error examples:**

| Input | Output |
| --- | --- |
| `GET /products?page=0` | `400` `{ "error": "page must be a whole number >= 1" }` |
| `GET /products?page=abc` | `400` `{ "error": "page must be a whole number >= 1" }` |
| `GET /products?page=1.5` | `400` `{ "error": "page must be a whole number >= 1" }` |
| `GET /products?pageSize=0` | `400` `{ "error": "pageSize must be 1-50" }` |
| `GET /products?pageSize=51` | `400` `{ "error": "pageSize must be 1-50" }` |

## How to check your work

1. **Tests:** `npm run test:express:8`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:8`. It starts your app on `http://localhost:3000` with products `p1` … `p8` and restarts it when you save. Send the requests in `requests.http` (VS Code extension **REST Client**).
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- You may use any npm package, for example `zod` for validation.
- Edit only `task8.ts`.
