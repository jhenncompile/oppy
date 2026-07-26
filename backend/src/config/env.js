import 'dotenv/config';
import { z } from 'zod';

/**
 * El entorno se valida una sola vez, al arrancar. Si falta algo, el proceso
 * muere de inmediato con un mensaje claro — nunca a mitad de una corrida del
 * agente, que es donde el error costaria una demo.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('*'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),

  LLM_PROVIDER: z.enum(['ollama']).default('ollama'),
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3.1:8b'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),

  EXA_API_KEY: z.string().default(''),
  FIRECRAWL_API_KEY: z.string().default(''),

  EXA_RESULTS_PER_QUERY: z.coerce.number().int().positive().default(8),
  MAX_SCORING_PER_RUN: z.coerce.number().int().positive().default(40),

  CRON_ENABLED: z.enum(['true', 'false']).default('false'),
  CRON_SCHEDULE: z.string().default('0 6 * * *'),

  // Reemplaza descubrimiento y evaluacion por datos de ejemplo: permite ver la
  // interfaz completa sin claves de scraping ni modelo servido. Solo para
  // desarrollo — `render.yaml` no define la variable.
  DEMO_MODE: z.enum(['true', 'false']).default('false')
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Configuracion de entorno invalida:\n${detail}`);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isDevelopment: raw.NODE_ENV === 'development',
  databaseSsl: raw.DATABASE_SSL === 'true',
  cronEnabled: raw.CRON_ENABLED === 'true',
  demoMode: raw.DEMO_MODE === 'true',
  /** Las capacidades opcionales se degradan solas si falta la key. */
  features: {
    exa: raw.EXA_API_KEY.length > 0,
    firecrawl: raw.FIRECRAWL_API_KEY.length > 0
  }
};
