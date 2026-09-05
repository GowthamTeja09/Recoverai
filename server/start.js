import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Explicitly load environment variables before importing any other modules
dotenv.config({ path: path.join(__dirname, '../.env') });

// 2. Log configuration status safely without leaking secret values
const isProd = process.env.NODE_ENV === 'production';
console.log(`[RecoverAI] Initializing startup sequence (ENV: ${process.env.NODE_ENV || 'development'}, DEMO_MODE: ${process.env.DEMO_MODE || 'true'})`);

// 3. Dynamically import the main server application now that env vars are guaranteed to be initialized
await import('./index.js');
