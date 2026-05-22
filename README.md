# Heap

Heap is a full-stack digital wallet app for managing cards, balances, users, and transactions. The frontend is a React/Vite app, and the backend is a FastAPI API backed by PostgreSQL, SQLAlchemy, and Alembic migrations.

## Tech Stack

- **Client:** React 19, Vite, Redux Toolkit, React Router, Tailwind CSS, shadcn/Radix UI, Axios
- **Server:** FastAPI, SQLAlchemy, Pydantic Settings, Alembic, PostgreSQL/psycopg
- **Tooling:** npm, uv, pytest, ESLint

## Project Structure

```text
.
|-- client/          # React/Vite frontend
|-- server/          # FastAPI backend, database models, routes, tests, migrations
`-- README.md
```

## Prerequisites

- Node.js and npm
- Python 3.13+
- uv
- PostgreSQL

## Environment

Create the backend environment file from the example:

```bash
cd server
cp .env.example .env
```

Update `server/.env` with your local database connection and secret values:

```env
HOST=127.0.0.1
PORT=8000
RELOAD=true
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME
SECRET_KEY=change-me
```

The client uses `http://localhost:8000` by default. To point it at a different API, create `client/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Installation

Install frontend dependencies:

```bash
cd client
npm install
```

Install backend dependencies:

```bash
cd server
uv sync
```

## Database

Run migrations after configuring `server/.env`:

```bash
cd server
uv run alembic upgrade head
```

## Development

Start the backend API:

```bash
cd server
uv run python main.py
```

The API runs at `http://127.0.0.1:8000` by default. Health check:

```bash
curl http://127.0.0.1:8000/health
```

Start the frontend:

```bash
cd client
npm run dev
```

The Vite app usually runs at `http://localhost:5173`.

## Available Scripts

Client:

```bash
npm run dev       # Start Vite dev server
npm run build     # Build production assets
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

Server:

```bash
uv run python main.py          # Start FastAPI app
uv run pytest                  # Run tests
uv run alembic upgrade head    # Apply database migrations
```

## Features

- Public landing page with login and registration flows
- Protected dashboard, wallet, payments, and settings routes
- Admin-only management area
- JWT authentication with refresh-token handling
- Card, transaction, user, role, and status APIs
- Centralized API error handling and frontend auth redirects
- Alembic migrations and backend test coverage
