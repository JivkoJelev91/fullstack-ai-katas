# Filter Products

**Task ID:** EXPRESS-005 · **Level:** 1 · **File:** `src/express/task5/task5.ts` · **Tests:** `npm run test:express:5`

Build one endpoint: `GET /products` returns the products, optionally filtered by `category` and `inStock`.

`createApp(initialProducts)` receives the products the app starts with. The starter already puts them into the `products` array. You write the handler.

## The Product object

| Field | Type | Example |
| --- | --- | --- |
| `id` | string | `"p5"` |
| `name` | string | `"Headlamp"` |
| `category` | string | `"gear"` |
| `priceCents` | number | `3999` (= 39.99) |
| `rating` | number | `4.5` |
| `inStock` | boolean | `true` |
| `tags` | string[] | `["camping", "night"]` |

The examples use an app started with these products:

| id | name | category | inStock |
| --- | --- | --- | --- |
| p1 | Trail Shoes | footwear | true |
| p2 | Road Shoes | footwear | false |
| p3 | Rain Jacket | apparel | true |
| p4 | Wool Socks | apparel | true |
| p5 | Headlamp | gear | true |
| p6 | Camping Stove | gear | false |
| p7 | water bottle | gear | true |
| p8 | Sleeping Bag | Gear | true |

## GET /products

**REQUIREMENT:**

- Return `200` with `{ "data": [ ...products ] }`, in the order they were added.
- Both query parameters are optional. Without them, return all products.
- `?category=gear` keeps only products with that category. Ignore upper/lower case: `gear`, `Gear` and `GEAR` are the same.
- `?inStock=true` or `?inStock=false` keeps only products with that `inStock` value.
- Both together: a product must match both.
- Any other query parameter is ignored.
- If `inStock` is anything other than `true` or `false`, return `400` with `{ "error": "<any message>" }`.

Query values always arrive as **strings**: `req.query.inStock` is `"true"`, not `true`.

**INPUT:**

```http
GET /products?category=gear
```

**OUTPUT:** p8 has category `"Gear"` and still matches

```http
200 OK
{ "data": [ { "id": "p5", ... }, { "id": "p6", ... }, { "id": "p7", ... }, { "id": "p8", ... } ] }
```

**INPUT:**

```http
GET /products?category=gear&inStock=true
```

**OUTPUT:**

```http
200 OK
{ "data": [ { "id": "p5", ... }, { "id": "p7", ... }, { "id": "p8", ... } ] }
```

**INPUT:** no matches is not an error

```http
GET /products?category=toys
```

**OUTPUT:**

```http
200 OK
{ "data": [] }
```

**Error examples:**

| Input | Output |
| --- | --- |
| `GET /products?inStock=yes` | `400` `{ "error": "inStock must be true or false" }` |
| `GET /products?inStock=1` | `400` `{ "error": "inStock must be true or false" }` |

## How to check your work

1. **Tests:** `npm run test:express:5`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:5`. It starts your app on `http://localhost:3000` with the products above and restarts it when you save. Send the requests in `requests.http` (VS Code extension **REST Client**).
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- Edit only `task5.ts`.
