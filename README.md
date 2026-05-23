# ECHO

**An AI-powered SRE assistant that detects, investigates, and explains API failures in real time.**

ECHO continuously monitors simulated API traffic, detects anomalies, autonomously investigates incidents with AI reasoning, reconstructs failure timelines, and suggests remediation — like an intelligent on-call engineer.

## Features

- **Real-time dashboard** — latency, error rate, throughput, service health, live logs
- **Anomaly detection** — threshold-based engine for latency spikes, error rates, auth/DB patterns
- **Autonomous RCA** — Gemini-powered investigation with rule-based fallbacks
- **Timeline reconstruction** — sequenced events leading to failure
- **AI chat assistant** — natural language incident queries
- **Failure simulation** — database crash, API timeout, auth failure, memory overload, traffic spike
- **WebSocket streaming** — live metrics, logs, alerts

## Architecture

```
Logs & Metrics → Anomaly Engine → AI Investigator → Dashboard + Incidents
                      ↑
              Simulation Panel (demo)
```

| Layer    | Stack                                      |
|----------|--------------------------------------------|
| Frontend | React, Vite, Tailwind, Recharts, Framer Motion |
| Backend  | FastAPI, WebSockets, async Python          |
| AI       | Google Gemini API (optional)               |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

pip install -r requirements.txt
copy .env.example .env
# Optional: set GEMINI_API_KEY in .env for live AI analysis

uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

### 3. Hackathon Demo Flow

1. Open **Simulation** → trigger **Database Crash**
2. Watch **Dashboard** — alert toast, error spike, live logs
3. Open **Incidents** → view AI root cause & timeline
4. Use **AI Chat** — *"Why did the payment API fail?"*

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/overview` | System overview |
| GET | `/api/metrics` | Metric time series |
| GET | `/api/logs` | Log stream history |
| GET | `/api/incidents` | List incidents |
| GET | `/api/incidents/{id}` | Incident detail |
| POST | `/api/simulate` | Trigger failure simulation |
| POST | `/api/chat` | AI chat |
| WS | `/ws` | Real-time events |

## Project Structure

```
Echo/
├── backend/
│   ├── agents/          # AI investigation agent
│   ├── analyzers/       # Anomaly detection
│   ├── ai/              # Gemini client
│   ├── simulator/       # Demo failure scenarios
│   ├── routes/          # REST + WebSocket
│   ├── services/        # Store & chat
│   └── main.py
└── frontend/
    ├── src/pages/       # Dashboard, Incidents, Chat, Settings
    ├── src/charts/      # Recharts visualizations
    └── src/websocket/   # Live client
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key (optional; fallbacks work without it) |
| `CORS_ORIGINS` | Allowed frontend origins |

## License

MIT
