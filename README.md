# StudioSpace API

**REST API for StudioSpace, a peer-to-peer marketplace for creative workspaces and production studios.**

Handles studio listings, reviews, bookings with double-booking prevention, wishlists, and JWT-secured mutations using HTTP-only cookies.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-HTTP--only_cookie-E8590C)

---

## Table of Contents

1. [Overview](#overview)
2. [Live Links](#live-links)
3. [Features](#features)
4. [Tech Stack](#tech-stack)
5. [Architecture and Auth Flow](#architecture-and-auth-flow)
6. [Project Structure](#project-structure)
7. [Local Setup](#local-setup)
8. [Environment Variables](#environment-variables)
9. [Scripts](#scripts)
10. [Seeding Sample Data](#seeding-sample-data)
11. [API Reference](#api-reference)
12. [Data Models](#data-models)
13. [Business Rules](#business-rules)
14. [Security](#security)
15. [Error Format](#error-format)
16. [Deployment](#deployment)
17. [Related Repositories](#related-repositories)

---

## Overview

This service powers the StudioSpace client. Studio owners publish listings, creators discover and book time slots, and the API guarantees that confirmed bookings never overlap. Identity comes from the client's Better Auth session, which this API exchanges for its own signed JWT stored in an HTTP-only cookie. Every write operation is protected by that token.

## Live Links

| Resource | Link |
|---|---|
| Client (production) | https://studiopha.netlify.app |
| API (production) | _Add your deployed API URL here_ |
| Client repository | https://github.com/mmhsohel/pherofrontend |
| Server repository | _Add this repository URL here_ |

---

## Features

- **Studio CRUD** with ownership enforced inside the database query, so users can only change their own listings.
- **Search, filter and sort** by keyword, category, price range, rating and date, with an optional `limit` for featured sections.
- **Booking engine** that validates time ranges, blocks past slots, blocks self-booking, and rejects overlaps with confirmed bookings (`409 Conflict`).
- **Availability endpoint** that returns confirmed slots for a studio on a given day.
- **Booking lifecycle**: Pending, Confirmed, Completed, Cancelled, with guest cancellation and host confirmation.
- **Reviews** with one review per user per studio and an atomic average-rating update.
- **Wishlist** toggle for saved studios.
- **JWT in HTTP-only cookies**: unauthenticated mutations return `401 Unauthorized`.
- **Seed scripts** for studios, bookings and reviews.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ (ES modules) |
| Framework | Express.js |
| Database | MongoDB (official Node driver) |
| Auth | JSON Web Tokens (`jsonwebtoken`), `cookie-parser` |
| Security | CORS with credentials, HTTP-only cookies |
| Config | `dotenv` |
| Dev tooling | `nodemon` |

---

## Architecture and Auth Flow

```
Client (Next.js + Better Auth)
   |  1. user signs in (email/password, Google or GitHub)
   |  2. Better Auth stores the session in MongoDB
   |  3. client calls POST /api/auth/jwt
   v
Express API
   |  4. reads the Better Auth session cookie
   |  5. verifies the session in the `session` collection
   |  6. issues a signed JWT in the HTTP-only cookie `ss_token`
   v
Protected routes: verifyJWT middleware -> req.user = { email, name }
```

The API trusts only the verified token for owner identity. `ownerEmail`, `userEmail` and the reviewer name are never read from the request body.

---

## Project Structure

```
studiospace-server/
  src/
    config/
      db.js                  MongoDB connection and collection helper
    middleware/
      verifyJWT.js           JWT cookie verification (401 on failure)
    routes/
      auth.routes.js         JWT issue and logout
      studios.routes.js      Studio CRUD, search, reviews
      bookings.routes.js     Booking creation, availability, status changes
      wishlist.routes.js     Saved studios
    seed/
      seed.js                Studios, bookings and sample reviews
      reviews.js             Adds sample reviews to studios with few reviews
    index.js                 App entry point
  .env
  package.json
```

---

## Local Setup

**Prerequisites:** Node.js 20 or later and a MongoDB Atlas database (or a local MongoDB instance).

1. Clone the repository and enter it:

   ```bash
   git clone <your-server-repository-url>
   cd studiospace-server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root (see [Environment Variables](#environment-variables)).

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Confirm it works by opening http://localhost:5000. You should see `StudioSpace API running`.

6. Start the client (see the client repository) with `API_URL=http://localhost:5000`.

> The `session` and `user` collections are created by Better Auth on the client side. Register a user in the client before calling `POST /api/auth/jwt`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Port the API listens on (default in docs: `5000`) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `DB_NAME` | Yes | Database name. Must match the database Better Auth uses on the client |
| `JWT_SECRET` | Yes | Long random string used to sign JWTs |
| `CLIENT_URL` | Yes | Exact client origin allowed by CORS (no trailing slash) |
| `NODE_ENV` | Production | Set to `production` to enable secure cross-site cookies |

Example `.env`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/studiospace
DB_NAME=studiospace
JWT_SECRET=replace_with_a_long_random_string
CLIENT_URL=http://localhost:3000
```

Never commit `.env`. Generate a strong secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start with automatic restart (nodemon) |
| `npm start` | Start in production mode |
| `npm run seed` | Reset and seed studios, bookings and sample reviews |
| `npm run seed:reviews` | Add sample reviews to studios that have fewer than 3 |

---

## Seeding Sample Data

Register these two accounts through the client first, because the seed assigns data to them:

| Role | Email |
|---|---|
| Examiner | `examiner@studiospace.com` |
| Host | `host@studiospace.com` |

Then run:

```bash
npm run seed
```

> **Warning:** `npm run seed` deletes everything in the `studios`, `bookings` and `wishlist` collections before inserting. Do not run it after real users have created data. `npm run seed:reviews` is non-destructive and safe to re-run.

The seed creates studios across all five categories, bookings in all four statuses, and reviews with computed average ratings. Booking dates are relative to today, so re-run the seed before a demo to keep upcoming slots in the future. It also creates indexes for category and rating queries and for booking overlap checks.

---

## API Reference

**Base URL:** `http://localhost:5000/api`

Routes marked **Auth** require the `ss_token` cookie. Without a valid token they return `401 Unauthorized`.

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/jwt` | Session | Exchanges a valid Better Auth session for the `ss_token` cookie |
| POST | `/auth/logout` | No | Clears the `ss_token` cookie |

### Studios

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/studios` | No | List studios. Query: `search`, `category`, `sort`, `limit`, `minPrice`, `maxPrice` |
| GET | `/studios/mine/list` | Yes | Studios owned by the signed-in user |
| GET | `/studios/:id` | No | Single studio (reviewer emails removed) |
| POST | `/studios` | Yes | Create a studio. Owner is set from the token |
| PUT | `/studios/:id` | Yes | Update a studio (owner only) |
| DELETE | `/studios/:id` | Yes | Delete a studio (owner only) |
| POST | `/studios/:id/reviews` | Yes | Add a review and recalculate the average rating |

**Sort values:** `newest` (default), `rating`, `priceAsc`, `priceDesc`.
**Category values:** `Photo Studio`, `Film Stage`, `Podcast Lounge`, `Music Suite`, `Workshop`.

Example, featured studios for the home page:

```
GET /api/studios?limit=6&sort=rating
```

Create studio request body:

```json
{
  "title": "Northlight Cyc Wall Studio",
  "category": "Photo Studio",
  "location": "Brooklyn, New York",
  "hourlyRate": 65,
  "deposit": 100,
  "capacity": 12,
  "image": "https://example.com/cover.jpg",
  "gallery": ["https://example.com/cover.jpg"],
  "amenities": ["WiFi", "Cyc Wall"],
  "overview": "A white cyclorama studio with north-facing windows."
}
```

Create review request body:

```json
{ "rating": 5, "comment": "Spotless space and a very responsive host." }
```

### Bookings

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/bookings` | Yes | Create a booking with status `Pending` |
| GET | `/bookings/mine` | Yes | Bookings made by the signed-in user |
| GET | `/bookings/host` | Yes | Booking requests on the user's studios |
| GET | `/bookings/availability/:studioId?date=YYYY-MM-DD` | No | Confirmed time slots for that day |
| PATCH | `/bookings/:id/cancel` | Yes | Guest cancels a `Pending` booking |
| PATCH | `/bookings/:id/confirm` | Yes | Host confirms a `Pending` booking (overlap re-checked) |

Create booking request body:

```json
{
  "studioId": "6aed6c5e60a359631576a199",
  "date": "2026-11-20",
  "startTime": "14:00",
  "endTime": "17:00"
}
```

### Wishlist

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/wishlist` | Yes | Saved studios of the signed-in user |
| POST | `/wishlist/toggle` | Yes | Save or remove a studio. Body: `{ "studioId": "..." }` |

### Status codes

| Code | Meaning |
|---|---|
| 200, 201 | Success, created |
| 400 | Validation failed (bad ID, invalid time range, past slot, own studio) |
| 401 | Missing, invalid or expired token |
| 403 | Not the owner of the resource |
| 404 | Resource or route not found |
| 409 | Conflict (overlapping booking, duplicate review) |

---

## Data Models

**studios**

```
_id, title, category, location,
hourlyRate (number), deposit (number), capacity (number),
image, gallery[], amenities[], overview,
ownerEmail, ownerName,
rating (number), reviews[ { userName, userEmail, rating, comment, date } ],
createdAt, updatedAt
```

**bookings**

```
_id, studioId, studioTitle, studioImage,
hostEmail, userEmail, userName,
date, startTime, endTime, startAt (Date), endAt (Date), hours,
hourlyRate, deposit, totalPrice,
status: "Pending" | "Confirmed" | "Completed" | "Cancelled",
createdAt
```

**wishlist**

```
_id, userEmail, studioId, createdAt
```

The `user` and `session` collections belong to Better Auth and are read-only for this API.

---

## Business Rules

**Double-booking prevention.** Before a booking is saved, and again when a host confirms it, the API looks for a `Confirmed` booking on the same studio where:

```
existing.startAt < new.endAt  AND  existing.endAt > new.startAt
```

A match returns `409 Conflict` with a message naming the occupied time.

**Booking validation**

- End time must be after start time.
- Past time slots are rejected.
- Owners cannot book their own studio.
- Total price = `hours x hourlyRate + deposit`, calculated on the server.

**Reviews**

- Rating must be a whole number from 1 to 5, comment 10 to 500 characters.
- One review per user per studio, and owners cannot review their own studio.
- The average rating is recalculated in the same atomic update.

**Ownership.** Update and delete queries include `ownerEmail` from the token, so another user's request matches nothing and returns `403`.

---

## Security

- JWT is stored in an **HTTP-only** cookie and is never readable by client scripts.
- In production the cookie is `Secure` with `SameSite=None`, and CORS allows only `CLIENT_URL` with credentials.
- Owner and reviewer identity come from the verified token, never from the request body.
- Client-controlled fields (`rating`, `reviews`, `ownerEmail`, `createdAt`) are stripped from update payloads.
- Numeric fields are converted and validated before saving.
- Secrets live in environment variables only.

---

## Error Format

All errors return JSON:

```json
{ "message": "Slot unavailable: already booked 10:00-14:00 on 2026-11-20" }
```

---

## Deployment

1. Push the repository and create a Node web service on Render, Railway or a similar host.
2. Build command: `npm install`. Start command: `npm start`.
3. Add every variable from [Environment Variables](#environment-variables), with `NODE_ENV=production` and `CLIENT_URL=https://studiopha.netlify.app`.
4. In MongoDB Atlas, allow your host's outbound IPs under **Network Access** (or `0.0.0.0/0` for a demo).
5. Set `API_URL` on the client to the deployed API URL and redeploy the client.
6. Run `npm run seed` once against the production database if you want sample data.

If the API is hosted on a free tier, the first request after idle time can take several seconds while the service wakes up.

---

## Related Repositories

- **Client (Next.js):** https://github.com/mmhsohel/pherofrontend