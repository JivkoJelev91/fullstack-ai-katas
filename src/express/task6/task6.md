# Search Products

**Task ID:** EXPRESS-006 · **Level:** 1 · **File:** `src/express/task6/task6.ts` · **Tests:** `npm run test:express:6`

Build one endpoint: `GET /products` returns the products, optionally filtered by a search text `q` and a price range.

`createApp(initialProducts)` receives the products the app starts with. The starter already puts them into the `products` array. You write the handler.

The `Product` object is the same as in EXPRESS-005. Prices are in cents: `8999` means 89.99.

The examples use an app started with these products:

| id | name | priceCents | tags |
| --- | --- | --- | --- |
| p1 | Trail Shoes | 12999 | running, outdoor |
| p2 | Road Shoes | 10999 | running |
| p3 | Rain Jacket | 8999 | outdoor, waterproof |
| p4 | Wool Socks | 1499 | winter |
| p5 | Headlamp | 3999 | camping, night |
| p6 | Camping Stove | 8999 | camping, cooking |
| p7 | water bottle | 1999 | hydration |
| p8 | Sleeping Bag | 15999 | camping, winter |

## GET /products

**REQUIREMENT:**

- Return `200` with `{ "data": [ ...products ] }`, in the order they were added.
- All query parameters are optional. Without them, return all products.
- `?q=camp` keeps products whose `name` **or** one of whose `tags` contains the text. Ignore upper/lower case. Trim spaces around `q` first.
- `?minPrice=4000` keeps products with `priceCents >= 4000`.
- `?maxPrice=9000` keeps products with `priceCents <= 9000`.
- Several parameters together: a product must match all of them.
- If `minPrice` or `maxPrice` is not a whole number `>= 0`, or `minPrice` is bigger than `maxPrice`, return `400` with `{ "error": "<any message>" }`.

**INPUT:**

```http
GET /products?q=camp
```

**OUTPUT:** p5 and p8 match by the tag `camping`, p6 by its name

```http
200 OK
{ "data": [ { "id": "p5", ... }, { "id": "p6", ... }, { "id": "p8", ... } ] }
```

**INPUT:**

```http
GET /products?minPrice=4000&maxPrice=9000
```

**OUTPUT:**

```http
200 OK
{ "data": [ { "id": "p3", "priceCents": 8999, ... }, { "id": "p6", "priceCents": 8999, ... } ] }
```

**INPUT:**

```http
GET /products?q=camp&maxPrice=9000
```

**OUTPUT:** p8 matches `camp` but costs too much

```http
200 OK
{ "data": [ { "id": "p5", ... }, { "id": "p6", ... } ] }
```

**Error examples:**

| Input | Output |
| --- | --- |
| `GET /products?minPrice=-1` | `400` `{ "error": "minPrice must be a whole number >= 0" }` |
| `GET /products?maxPrice=abc` | `400` `{ "error": "maxPrice must be a whole number >= 0" }` |
| `GET /products?minPrice=9.5` | `400` `{ "error": "minPrice must be a whole number >= 0" }` |
| `GET /products?minPrice=5000&maxPrice=1000` | `400` `{ "error": "minPrice must not be bigger than maxPrice" }` |

`Number("abc")` is `NaN`, and `Number.isInteger(NaN)` is `false`.

## How to check your work

1. **Tests:** `npm run test:express:6`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:6`. It starts your app on `http://localhost:3000` with the products above and restarts it when you save. Send the requests in `requests.http` (VS Code extension **REST Client**).
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- You may use any npm package, for example `zod` for validation.
- Edit only `task6.ts`.
