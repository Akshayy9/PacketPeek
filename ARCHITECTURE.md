# PacketPeek Architecture

PacketPeek is a full-stack nutritional analysis application designed to provide users with immediate, accurate, and actionable insights into the food products they consume. 

## System Overview

The system is designed with a split architecture to optimize for edge performance on the frontend and heavy computational tasks on the backend.

- **Frontend (Cloudflare Pages):** Built with Next.js (App Router) and Tailwind CSS. Deploying to Cloudflare Pages ensures the static assets and edge functions are served as close to the user as possible, minimizing latency for the initial load and UI interactions.
- **Backend (Render):** Built with Express and TypeScript running on Node.js. Render provides a robust environment for our API, handling database connections, AI processing, and complex business logic.

## The Scan & Fetch Workflow

The core user journey begins with scanning a physical product.

1. **Product Lookup:** The user can initiate a search either by scanning a barcode using `react-zxing` (a high-performance WebAssembly barcode scanner) or by manually typing a text search if the scan fails or the barcode is unreadable.
2. **API Request:** The Next.js frontend dispatches an API request to the Render backend (e.g., `/api/product/:barcode`).
3. **Data Retrieval & Fallbacks:** 
   - **Cache Hit:** The backend first checks the local MongoDB database.
   - **External Fetch:** If not found, it queries external sources like the Open Food Facts API, transforming and normalizing the data before saving it locally.
   - **User Contribution (AI Vision):** If the product is entirely missing from external databases, signed-in users are prompted to upload a photo of the packaging. The backend uses Google Gemini Vision to extract the ingredients and nutritional data, saving it as a user-contributed product against that barcode.

## Data Processing & Scoring

PacketPeek utilizes a **Deterministic Rule Engine** to process nutritional data and calculate the Child Safety Verdict. 

We explicitly avoid using Large Language Models (LLMs) for this critical scoring step to eliminate the risk of hallucinations. Instead, the backend extracts specific parameters from the product data:
- `added_sugar_g` (number)
- `has_honey` (boolean)
- `has_artificial_sweeteners` (boolean)
- `artificial_colors` (array of strings)

These parameters are passed through pure TypeScript functions (e.g., `calculateChildSafety`). The rule engine applies strict, deterministic logic (e.g., Honey triggers a 1-year age limit, specific artificial colors trigger a 12-year age limit) to return a safe, reliable, and mathematically sound verdict.

## RAG Pipeline (Healthy Alternatives)

To suggest healthier alternatives to scanned products, the backend employs a Retrieval-Augmented Generation (RAG) pipeline.

1. **Vector Search:** The backend extracts the scanned product's category and nutritional profile and queries a Vector Database (Pinecone).
2. **Context Retrieval:** Pinecone returns a list of products that match the exact same category and packaging format (e.g., prioritizing multi-pack biscuits over single-serve cookies if a multi-pack was scanned).
3. **LLM Injection:** These retrieved candidates, along with the scanned product's negative nutritional traits, are injected into the system prompt of our LLM (Gemini).
4. **Strict Ranking:** The LLM evaluates the candidates against strict rules, prioritizing alternatives that offer a significantly better nutritional profile while maintaining the closest format similarity. It returns a strictly ranked JSON array of the top 3-5 healthier alternatives, which the backend forwards to the frontend.

## Cross-Origin Strategy

Because the frontend and backend are deployed on entirely separate domains (Cloudflare and Render), the backend implements a strict Cross-Origin Resource Sharing (CORS) strategy. 

The Express backend is configured with the `cors` middleware, specifically whitelisting the Cloudflare Pages production URL (and `localhost` for development) in the `Access-Control-Allow-Origin` headers. This ensures that the frontend can securely communicate with the API while preventing unauthorized access from external domains.
