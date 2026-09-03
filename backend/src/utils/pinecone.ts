import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const geminiApiKey = process.env.GEMINI_API_KEY;
const pineconeApiKey = process.env.PINECONE_API_KEY;

if (!geminiApiKey) {
  console.warn('⚠️ GEMINI_API_KEY is missing');
}
if (!pineconeApiKey) {
  console.warn('⚠️ PINECONE_API_KEY is missing');
}

export const ai = new GoogleGenAI(geminiApiKey ? { apiKey: geminiApiKey } : {});
export const pinecone = new Pinecone(pineconeApiKey ? { apiKey: pineconeApiKey } : { apiKey: '' });

export const PINECONE_INDEX_NAME = 'packetpeek';

/**
 * Generate embedding for a product document
 */
export async function generateDocumentEmbedding(title: string, content: string): Promise<number[]> {
  const text = `title: ${title} | text: ${content}`;
  
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: text,
    config: {
      outputDimensionality: 768,
    }
  });
  
  if (!response.embeddings || !response.embeddings[0] || !response.embeddings[0].values) {
    throw new Error('Failed to generate document embedding');
  }
  
  // The API returns an array of embeddings in response.embeddings[0].values
  return response.embeddings[0].values;
}

/**
 * Generate embedding for a search query
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const text = `task: search result | query: ${query}`;
  
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-2',
    contents: text,
    config: {
      outputDimensionality: 768,
    }
  });
  
  if (!response.embeddings || !response.embeddings[0] || !response.embeddings[0].values) {
    throw new Error('Failed to generate query embedding');
  }
  
  return response.embeddings[0].values;
}
