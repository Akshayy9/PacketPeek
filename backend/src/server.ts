import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import productRouter from './routes/product';
import aiRouter from './routes/ai';

const app = express();
const PORT = parseInt(process.env.PORT ?? '4000', 10);

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://packetpeek-998.pages.dev'
      // Allow any origin in development — tighten in production

    ],
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  })
);
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'PacketPeek API', ts: new Date().toISOString() });
});

app.use('/api/product', productRouter);
app.use('/api/products', aiRouter);

// ── 404 catch-all ───────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Boot ────────────────────────────────────────────────────────────────────
async function main() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 PacketPeek API running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   Product lookup: http://localhost:${PORT}/api/product/:barcode`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
