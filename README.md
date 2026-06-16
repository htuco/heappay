<div align="center">

<img src="client/public/logo-brand.png" alt="Heap" width="120" />

# Heap

**A full-stack digital wallet — cards, balances, transactions, and money requests in one product.**

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111111)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=ffffff)
![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?style=for-the-badge&logo=fastapi&logoColor=ffffff)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql&logoColor=ffffff)
![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=for-the-badge&logo=python&logoColor=ffffff)

![Status](https://img.shields.io/badge/status-active-success?style=flat-square)
![License](https://img.shields.io/badge/license-private-lightgrey?style=flat-square)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)

</div>

---

## Overview

Heap unifies a clean consumer wallet — cards, ledger & available balance, send/receive
transactions, refunds, and money requests — with a separate, role-gated admin area for
managing users and reference data. One product, one codebase, one auth flow.

The frontend is a **React 19 + Vite** SPA. The backend is a **FastAPI** service backed by
**PostgreSQL**, **SQLAlchemy 2.0**, and **Alembic** migrations.

## ✨ Features

- 🔐 **Auth** — JWT access + refresh tokens, bcrypt password hashing, centralized 401 handling
- 🛡️ **Two-factor auth (TOTP)** — authenticator-app 2FA with secrets encrypted at rest
- 💳 **Cards** — add, view, manage status and types; main-card selection
- 💸 **Transactions** — send, receive, settle (apply-on-settle), filterable history
- 🔁 **Refunds & money requests** — modeled via a polymorphic requests table
- 💰 **Top Up via FEP Nexus** — request funds, operator approval, auto-credit on approval
- 🧮 **Balances** — ledger balance vs. available balance (ledger − pending outgoing) + reserved funds
- 🛠️ **Admin** — user, role, status, and reference-data management (role-gated)

## 🧱 Tech Stack

| Layer | Technologies |
| ----- | ------------ |
| **Client** | React 19, Vite, Redux Toolkit, React Router v7, Tailwind CSS v4, shadcn/Radix UI, Axios, Zod |
| **Server** | FastAPI, SQLAlchemy 2.0, Pydantic Settings, Alembic, PostgreSQL (psycopg) |
| **Auth** | JWT (pyjwt) + bcrypt, TOTP (pyotp) with Fernet-encrypted secrets |
| **Tooling** | npm, uv, pytest, ESLint |

## 📁 Project Structure

```text
.
├── client/   # React/Vite frontend (pages, components, store, services, schemas)
├── server/   # FastAPI backend — routes → services → repositories → models/schemas
│             # plus alembic/ migrations, jobs/ schedulers, tests/
└── README.md
```

The backend follows a layered, feature-folder layout: `routes/<feature>/` →
`services/<feature>/` → `repositories/<feature>/` → `models/` + `schemas/`.
Feature folders: `card`, `request`, `transaction`, `user`, `nexus`.

## 🚀 Getting Started

### Prerequisites

- Node.js & npm
- Python 3.13+ and [uv](https://github.com/astral-sh/uv)
- PostgreSQL

### 1. Environment

```bash
cd server
cp .env.example .env
```

Fill in `server/.env` with your local database and secrets. Generate the security keys:

```bash
# JWT signing key
uv run python -c "import secrets; print(secrets.token_urlsafe(48))"

# TOTP 2FA encryption key (Fernet) — required to enable 2FA
uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

The client targets `http://localhost:8000` by default. To override, create `client/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### 2. Install dependencies

```bash
cd client && npm install
cd ../server && uv sync
```

### 3. Run migrations

```bash
cd server
uv run alembic upgrade heads
```

> `heads` (plural) — the migration tree has multiple heads after the 2FA merge.

### 4. Start the app (two terminals)

```bash
# Terminal 1 — backend → http://127.0.0.1:8000  (Swagger UI at /docs)
cd server && uv run python main.py

# Terminal 2 — frontend → http://localhost:5173
cd client && npm run dev
```

Health check: `curl http://127.0.0.1:8000/health`

## 💰 Top Up via FEP Nexus

Card top-ups go through the external FEP Nexus treasury service. After a one-time install
(writes `NEXUS_*` credentials into `server/.env`):

```bash
curl -sSf "https://fep-funds-production.up.railway.app/install/heap?key=<KEY>" | sh
```

**Flow:** Dashboard → Top Up → **Request Funds** → operator approves in the FEP dashboard →
the in-app scheduler credits the card within ~60s.

> Without the `NEXUS_*` vars in `.env`, Top Up falls back to the legacy instant-deposit path.

## 🧪 Scripts

**Client**

```bash
npm run dev       # Vite dev server
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # ESLint
```

**Server**

```bash
uv run python main.py                              # Start FastAPI app
uv run pytest                                      # Run tests
uv run alembic upgrade heads                       # Apply migrations
uv run alembic revision --autogenerate -m "<msg>"  # New migration (review the diff!)
uv run python -m jobs.process_pending_transactions # Process pending transactions manually
```

## ⚙️ Transaction Processor

Pending payments are held in escrow until the processor completes or fails them. Starting
the API also starts an in-process scheduler that runs the processor once immediately, then
every `TX_PROCESSOR_INTERVAL_SECONDS` (default 60). It also polls FEP Nexus for approved
top-ups on the same interval.

Set `TX_PROCESSOR_SCHEDULER_ENABLED=false` to use an external cron instead (recommended
when running multiple API workers):

```cron
* * * * * cd /path/to/heap/server && uv run python -m jobs.process_pending_transactions >> /var/log/heap-tx-processor.log 2>&1
* * * * * sleep 30; cd /path/to/heap/server && uv run python -m jobs.process_pending_transactions >> /var/log/heap-tx-processor.log 2>&1
```

## 🤝 Contributing

- **Branches:** `feature/<thing>` / `fix/<thing>`, off the latest `main`. Pull `main` before pushing.
- **Commits:** Title Case, small logical chunks.
- **PRs:** English, using `.github/pull_request_template.md`. Link the issue with `Closes #<n>`.
- **Conventions:** balance changes apply on **settle**, not on create; all env config is read
  through `settings.py` (pydantic-settings), never `os.getenv`.

---

<div align="center">

<img src="client/public/logo-brand.png" alt="Heap" width="28" />

**Built by the Heap team** · Future Experts Program

</div>
