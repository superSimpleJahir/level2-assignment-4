<div align="center">

# 🔧 FixItNow API

**Your trusted home service platform — backend**

Book verified technicians for plumbing, electrical work, cleaning, AC repair and more.
Pay securely with Stripe, track every job, and leave a review when it's done.

![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-4169E1?logo=postgresql&logoColor=white)
![Stripe](https://img.shields.io/badge/Payments-Stripe-635BFF?logo=stripe&logoColor=white)

</div>

---

## 📌 Submission details

| Item | Link / Value |
|------|--------------|
| **Backend repo** | `<your GitHub repo URL>` |
| **Live API** | `<your deployed URL>` &nbsp;→&nbsp; health check at `/api/health` |
| **API docs (Swagger)** | `<your deployed URL>/api/docs` |
| **API docs (Postman)** | [`docs/FixItNow.postman_collection.json`](./docs/FixItNow.postman_collection.json) |
| **Demo video** | `<your video link>` |

### 🔑 Demo accounts

All of these are created by the seed script (`npm run db:seed`).

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@fixitnow.com` | `Admin@12345` |
| **Customer** | `tania@example.com` | `Customer@123` |
| **Technician** | `rahim.plumber@fixitnow.com` | `Tech@12345` |

> Other seeded technicians: `karim.electric@`, `sumaiya.clean@`, `nasir.ac@` (all `@fixitnow.com`, same password).

---

## 📖 Table of contents

- [What is FixItNow?](#-what-is-fixitnow)
- [Features](#-features)
- [Tech stack](#-tech-stack)
- [Getting started](#-getting-started)
- [Environment variables](#-environment-variables)
- [Available scripts](#-available-scripts)
- [Project structure](#-project-structure)
- [API overview](#-api-overview)
- [How a booking works](#-how-a-booking-works)
- [Payments with Stripe](#-payments-with-stripe)
- [Error handling & validation](#-error-handling--validation)
- [Database design](#-database-design)
- [Testing](#-testing)
- [Deployment](#-deployment)

---

## 🏠 What is FixItNow?

FixItNow is a marketplace backend that connects people who need something fixed with people who can fix it.

- **Customers** browse services, pick a technician and a time slot, pay online and rate the work.
- **Technicians** publish the services they offer, set their weekly availability and manage incoming jobs.
- **Admins** keep the platform healthy: managing users, categories, bookings and payments.

The API is a REST API that returns JSON and uses JWT bearer tokens for authentication.

---

## ✨ Features

**For everyone (public)**
- Browse services and technicians
- Search, filter (category, city, price range, rating, skill), sort and paginate
- Technician profile with services, weekly availability and customer reviews

**For customers**
- Register / login, update profile, change password
- Book a technician for a specific date and time
- Pay through **Stripe Checkout** once the technician accepts
- Payment history and status tracking
- Cancel before the job starts (paid bookings are **refunded automatically**)
- Review a technician after the job is completed

**For technicians**
- Maintain a profile (skills, experience, hourly rate, city)
- Create and manage the services they offer
- Set weekly availability slots
- Accept or decline requests, start the job and mark it complete

**For admins**
- View all users, ban / unban accounts
- View every booking and payment
- Create, edit, disable and delete service categories

**Under the hood**
- Role-based access control (customer / technician / admin)
- Double-booking protection and availability checks
- Zod validation on every endpoint and a consistent error format
- Idempotent payment confirmation (works from both the redirect flow and the webhook)
- Rate limiting, Helmet security headers, CORS

---

## 🧰 Tech stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js + Express 4 |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma 6 (schema, migrations, seed) |
| Auth | JWT + bcrypt |
| Validation | Zod |
| Payments | Stripe Checkout + webhooks |
| Docs | Swagger UI (OpenAPI 3) + Postman collection |
| Deployment | Vercel or Render |

---

## 🚀 Getting started

### Prerequisites

- **Node.js 18+**
- **PostgreSQL** running locally (or a hosted one such as Neon / Supabase / Render)
- A free **Stripe** account in *test mode* (only needed to try real payments)

### 1. Clone and install

```bash
git clone <your-repo-url> fixitnow-backend
cd fixitnow-backend
npm install
```

### 2. Create your `.env`

```bash
cp .env.example .env
```

Then open `.env` and fill in at least `DATABASE_URL` and `JWT_SECRET`. See [Environment variables](#-environment-variables) for details.

### 3. Create the database

```bash
createdb fixitnow          # or create it from pgAdmin / your hosting dashboard
npm run db:migrate         # applies all migrations
npm run db:seed            # admin + categories + demo technicians and customers
```

### 4. Start the server

```bash
npm run dev
```

The API is now running at **http://localhost:4000**

| URL | What it is |
|-----|------------|
| http://localhost:4000/api/health | Health check |
| http://localhost:4000/api/docs | Swagger UI — try every endpoint in the browser |

---

## 🔐 Environment variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `PORT` | | Server port (default `4000`) |
| `NODE_ENV` | | `development` or `production` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Long random string used to sign tokens (16+ chars) |
| `JWT_EXPIRES_IN` | | Token lifetime, default `7d` |
| `BCRYPT_SALT_ROUNDS` | | Password hashing cost, default `10` |
| `STRIPE_SECRET_KEY` | ✅ for payments | Stripe **test** secret key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | ✅ for webhooks | Signing secret (`whsec_...`) |
| `CLIENT_URL` | | Where Stripe redirects the customer after paying |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | | Credentials the seed script gives the admin account |

> The app validates these on startup and stops with a clear message if something important is missing. If `STRIPE_SECRET_KEY` is empty the rest of the API still works; only the payment-creation endpoint answers with a clean `503`.

---

## 📜 Available scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the API with auto-reload |
| `npm run build` | Generate the Prisma client and compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | Type-check without emitting files |
| `npm run db:migrate` | Create / apply migrations in development |
| `npm run db:deploy` | Apply existing migrations (production) |
| `npm run db:seed` | Seed the database (safe to run repeatedly) |
| `npm run db:reset` | Drop, re-migrate and re-seed the database |
| `npm run test:e2e` | Run the end-to-end flow against a running server |
| `npm run docs:postman` | Regenerate the Postman collection from the OpenAPI spec |
