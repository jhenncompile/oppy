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

  // URL publica de serve_oppy_api.py (Colab+ngrok, VPS GPU, etc.).
  // Si esta set, normalize/match usan el LoRA y caen a Ollama si falla.
  OPPY_API_URL: z.string().default(''),

  EXA_API_KEY: z.string().default(''),
  FIRECRAWL_API_KEY: z.string().default(''),

  // Zavu — mensajeria unificada para las notificaciones. https://zavu.dev
  ZAVUDEV_API_KEY: z.string().default(''),
  // Por debajo de este puntaje no se molesta a nadie: una notificacion que no
  // valia la pena entrena a la persona a ignorar las siguientes.
  NOTIF_MATCH_THRESHOLD: z.coerce.number().int().min(0).max(100).default(80),
  NOTIF_MAX_POR_USUARIO: z.coerce.number().int().positive().default(3),

  EXA_RESULTS_PER_QUERY: z.coerce.number().int().positive().default(4),
  // Tope de paginas a estructurar por corrida: sin esto, 20+ llamadas
  // secuenciales a Ollama dejan la UI en "Leyendo y estructurando…" minutos.
  MAX_NORMALIZE_PER_RUN: z.coerce.number().int().positive().default(6),
  NORMALIZE_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  MAX_SCORING_PER_RUN: z.coerce.number().int().positive().default(20),

  CRON_ENABLED: z.enum(['true', 'false']).default('false'),
  CRON_SCHEDULE: z.string().default('0 6 * * *'),

  // Reemplaza descubrimiento y evaluacion por datos de ejemplo: permite ver la
  // interfaz completa sin claves de scraping ni modelo servido. Solo para
  // desarrollo — `render.yaml` no define la variable.
  DEMO_MODE: z.enum(['true', 'false']).default('false'),

  // Contacto del perfil de demo, para que el aviso de Zavu llegue a algun lado
  // durante una demostracion en vivo.
  //
  // Va por entorno y NO dentro de `seed.js` porque ese archivo se versiona: un
  // correo o un telefono en un repositorio publico se scrapea para siempre.
  // Sin estos valores el seed crea los perfiles sin contacto y nadie recibe
  // nada, que es el comportamiento correcto por defecto.
  DEMO_CONTACTO_EMAIL: z.string().email().or(z.literal('')).default(''),
  // En formato internacional: Zavu elige el canal por el formato del
  // destinatario, y un numero sin prefijo de pais no le dice a donde mandarlo.
  DEMO_CONTACTO_TELEFONO: z.string().regex(/^\+\d{8,15}$/).or(z.literal('')).default('')
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
  /** Las capacidades opcionales se degradan solas si falta la key / URL. */
  features: {
    exa: raw.EXA_API_KEY.length > 0,
    firecrawl: raw.FIRECRAWL_API_KEY.length > 0,
    zavu: raw.ZAVUDEV_API_KEY.length > 0,
    oppy: looksLikeUrl(raw.OPPY_API_URL)
  }
};

function looksLikeUrl(value) {
  if (!value || value.length < 8) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
