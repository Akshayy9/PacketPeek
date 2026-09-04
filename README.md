# PacketPeek 

> Scan a packaged food barcode in your browser → get product data from Open Food Facts → cached in MongoDB.

---

## Prerequisites

- **Node.js 18+**
- **MongoDB** running locally on the default port (`27017`), or a MongoDB Atlas URI

---

## Project Structure

```
PacketPeek/
├── backend/          # Express + TypeScript + Mongoose
│   ├── src/
│   │   ├── config/db.ts          # Mongoose connection
│   │   ├── models/Product.ts     # products collection schema
│   │   ├── routes/product.ts     # GET /api/product/:barcode
│   │   ├── services/offClient.ts # Open Food Facts API client + normalizer
│   │   └── server.ts             # Express entry point
│   ├── .env.example
│   └── package.json
│
└── frontend/         # Next.js 14 App Router + TypeScript
    ├── app/
    │   └── scan/page.tsx         # /scan route
    ├── components/
    │   └── BarcodeScanner.tsx    # html5-qrcode wrapper
    ├── .env.local.example
    └── package.json
```

---

## Running Locally

### 1. Backend

```bash
cd backend

# Copy env and edit if needed (e.g. Atlas URI)
cp .env.example .env

# Install deps (already done if you ran npm install)
npm install

# Start dev server (hot-reload via ts-node-dev)
npm run dev
```

Backend starts at **http://localhost:4000**

Health check: `GET http://localhost:4000/health`

---

### 2. Frontend

```bash
cd frontend

# Copy env
cp .env.local.example .env.local

# Install deps (already done)
npm install

# Start Next.js dev server
npm run dev
```

Frontend at **http://localhost:3000** → navigate to **http://localhost:3000/scan**

---

## API Reference

### `GET /api/product/:barcode`

| Case | Status | Response |
|---|---|---|
| Found in MongoDB (cache hit) | 200 | `{ found: true, source: "cache", product: {...} }` |
| Found in Open Food Facts (cache miss) | 200 | `{ found: true, source: "off", product: {...} }` |
| Not found anywhere | 404 | `{ found: false, barcode: "..." }` |
| Server error | 500 | `{ error: "message" }` |

---

## Testing the Pipeline

1. Scan **Kurkure** barcode `8901491103084` — should return `source: "off"` on first scan
2. Scan it again — should return `source: "cache"` (no OFF request in server logs)
3. Scan `0000000000000` — should return 404 / "not found" state in UI

---

## Environment Variables

### Backend (`.env`)
| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017/zaika_score` | MongoDB connection string |
| `PORT` | `4000` | Express server port |

### Frontend (`.env.local`)
| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000` | Backend API base URL |

---

## Phase Roadmap

- **Phase 1 (this)** — Barcode scan → OFF lookup → MongoDB cache
- **Phase 2** — Nutri-Score display, Zaika Score calculation, ingredient risk tagging
- **Phase 3** — OCR fallback for products not in Open Food Facts
- **Phase 4** — User accounts, scan history, React Native app
