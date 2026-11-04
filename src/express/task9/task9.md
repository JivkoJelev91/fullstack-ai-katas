# Products from an Async Catalog

**Task ID:** EXPRESS-009 · **Level:** 1 · **File:** `src/express/task9/task9.ts` · **Tests:** `npm run test:express:9`

Build two endpoints that read products from an **async** source (like a database) and handle the case when that source fails.

`createApp(deps)` receives `deps.catalog`. `await deps.catalog.getAll()` returns all products. It can also **throw** (the database is down).

The `Product` object is the same as in EXPRESS-005.

## Rules for both endpoints

- Call `await deps.catalog.getAll()` on **every** request. Don't save the result: the catalog can change between requests.
- If `getAll()` throws, return `500` with `{ "error": "Something went wrong" }`. Do **not** send the original error message: it can contain secrets like server names.

There are two ways to catch the error. Pick one:

1. `try { ... } catch { ... }` inside each handler.
2. An **error middleware**: a function with 4 parameters, registered after the routes. In Express 5, an error thrown in an `async` handler goes straight to it.

```ts
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({ error: "Something went wrong" });
});
```

## GET /products

**REQUIREMENT:** Return `200` with `{ "data": [ ...all products ] }`.

**INPUT:**

```http
GET /products
```

**OUTPUT:**

```http
200 OK
{ "data": [ { "id": "p1", ... }, { "id": "p2", ... }, ... ] }
```

## GET /products/:id

**REQUIREMENT:** Return `200` with the product that has this id. If there is none, return `404` with `{ "error": "<any message>" }`.

**INPUT:**

```http
GET /products/p5
```

**OUTPUT:**

```http
200 OK
{ "id": "p5", "name": "Headlamp", "category": "gear", "priceCents": 3999, "rating": 4.5,
  "inStock": true, "tags": ["camping", "night"] }
```

**Error examples:**

| Input | Output |
| --- | --- |
| `GET /products/p99` | `404` `{ "error": "Product not found" }` |
| `GET /products` when `getAll()` throws | `500` `{ "error": "Something went wrong" }` |
| `GET /products/p5` when `getAll()` throws | `500` `{ "error": "Something went wrong" }` |

## How to check your work

1. **Tests:** `npm run test:express:9`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:9`. It starts **two** copies of your app: `http://localhost:3000` with a working catalog (`p1` … `p8`) and `http://localhost:3001` with a catalog that always throws. Send the requests in `requests.http` (VS Code extension **REST Client**).
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- Edit only `task9.ts`.
