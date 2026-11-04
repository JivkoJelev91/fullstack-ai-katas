# Sort Products

**Task ID:** EXPRESS-007 · **Level:** 1 · **File:** `src/express/task7/task7.ts` · **Tests:** `npm run test:express:7`

Build one endpoint: `GET /products?sort=...` returns the products in the requested order.

`createApp(initialProducts)` receives the products the app starts with. The starter already puts them into the `products` array. You write the handler.

The `Product` object is the same as in EXPRESS-005.

The examples use an app started with these products:

| id | name | priceCents | rating |
| --- | --- | --- | --- |
| p1 | Trail Shoes | 12999 | 4.6 |
| p2 | Road Shoes | 10999 | 4.2 |
| p3 | Rain Jacket | 8999 | 4.1 |
| p4 | Wool Socks | 1499 | 4.6 |
| p5 | Headlamp | 3999 | 4.5 |
| p6 | Camping Stove | 8999 | 4.3 |
| p7 | water bottle | 1999 | 4.0 |
| p8 | Sleeping Bag | 15999 | 4.9 |

## GET /products

**REQUIREMENT:**

- Return `200` with `{ "data": [ ...products ] }`.
- Without `sort`, keep the order the products were added in.
- `sort` can be one of these six values:

| `sort` | Order |
| --- | --- |
| `price` | `priceCents`, cheapest first |
| `-price` | `priceCents`, most expensive first |
| `rating` | `rating`, lowest first |
| `-rating` | `rating`, highest first |
| `name` | `name` A → Z, ignoring upper/lower case |
| `-name` | `name` Z → A, ignoring upper/lower case |

- **Ties:** when two products have the same value, the one with the smaller `id` comes first (also for `-price`, `-rating` and `-name`).
- Any other `sort` value: return `400` with `{ "error": "<any message>" }`.
- Sorting must not change the stored order: a later `GET /products` without `sort` still returns p1 … p8.

`array.sort()` changes the array it is called on. Sort a copy: `[...products].sort(...)`.

**INPUT:**

```http
GET /products?sort=price
```

**OUTPUT:** p3 and p6 both cost 8999, so p3 comes first

```http
200 OK
{ "data": [ p4, p7, p5, p3, p6, p2, p1, p8 ] }
```

**INPUT:**

```http
GET /products?sort=-rating
```

**OUTPUT:** p1 and p4 both have 4.6, so p1 comes first

```http
200 OK
{ "data": [ p8, p1, p4, p5, p6, p2, p3, p7 ] }
```

**INPUT:**

```http
GET /products?sort=name
```

**OUTPUT:** `"water bottle"` is sorted as if it were `"Water bottle"`

```http
200 OK
{ "data": [ p6 Camping Stove, p5 Headlamp, p3 Rain Jacket, p2 Road Shoes, p8 Sleeping Bag, p1 Trail Shoes, p7 water bottle, p4 Wool Socks ] }
```

**Error examples:**

| Input | Output |
| --- | --- |
| `GET /products?sort=popularity` | `400` `{ "error": "Invalid sort" }` |
| `GET /products?sort=` | `400` `{ "error": "Invalid sort" }` |
| `GET /products?sort=Price` | `400` `{ "error": "Invalid sort" }` |

## How to check your work

1. **Tests:** `npm run test:express:7`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:7`. It starts your app on `http://localhost:3000` with the products above and restarts it when you save. Send the requests in `requests.http` (VS Code extension **REST Client**).
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- Edit only `task7.ts`.
