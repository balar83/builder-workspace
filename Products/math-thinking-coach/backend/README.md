# Math Thinking Coach — Backend

FastAPI backend for the Math Thinking Coach application. See `../docs/README.md` for the current product overview and `../docs/Phase-1-Handoff.md` for the full architecture.

## Setup

### 1. Create a virtual environment

```bash
python -m venv .venv
```

### 2. Activate the virtual environment

Windows:

```bash
.venv\Scripts\activate
```

macOS / Linux:

```bash
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Copy `.env.example` to `.env` and adjust values if needed:

```bash
cp .env.example .env
```

## Run the server

```bash
uvicorn app.main:app --reload
```

The server starts at `http://localhost:8000`.

## Endpoints

- API docs (Swagger): `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/v1/health`

## Run tests

```bash
python -m pytest
```
