# PacketPeek

PacketPeek is a full-stack nutritional analysis application that provides immediate, accurate, and actionable insights into food products. By utilizing real-time barcode scanning and deterministic rule engines, it strictly evaluates child safety parameters and leverages a RAG pipeline to suggest healthier alternatives.

## Tech Stack

- Frontend: Next.js (App Router), React, Tailwind CSS, react-zxing (WebAssembly)
- Backend: Node.js, Express, TypeScript
- Database & AI: MongoDB, Pinecone (Vector Database), Google Gemini API
- Deployment: Cloudflare Pages (Frontend), Render (Backend)

## Environment Variables

### Frontend (.env.local)
| Variable | Description |
| --- | --- |
| NEXT_PUBLIC_API_URL | The URL of the backend API (e.g., http://localhost:4000) |
| NEXT_PUBLIC_FIREBASE_API_KEY | Firebase API Key |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Firebase Auth Domain |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Firebase Project ID |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | Firebase Storage Bucket |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Firebase Messaging Sender ID |
| NEXT_PUBLIC_FIREBASE_APP_ID | Firebase App ID |

### Backend (.env)
| Variable | Description |
| --- | --- |
| PORT | The port for the Express server (e.g., 4000) |
| MONGODB_URI | MongoDB connection string |
| GEMINI_API_KEY | Google Gemini API Key |
| PINECONE_API_KEY | Pinecone Vector Database API Key |
| SERPER_API_KEY | Serper API Key |
| GOOGLE_APPLICATION_CREDENTIALS | Path to Firebase Admin JSON file |

## Local Development

### 1. Install Dependencies
Open a terminal and install dependencies for both frontend and backend.

```bash
# Install frontend dependencies
cd frontend
npm install

# In a new terminal, install backend dependencies
cd backend
npm install
```

### 2. Run the Servers Concurrently
Start both development servers.

```bash
# Terminal 1: Run frontend
cd frontend
npm run dev

# Terminal 2: Run backend
cd backend
npm run dev
```

The frontend will be available at http://localhost:3000 and the backend API at http://localhost:4000.
