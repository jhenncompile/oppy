-- Esquema de Oppy.
--
-- Decision estructural: el indice de oportunidades es COMPARTIDO. El cron
-- descubre una vez para todos (tabla `opportunities`) y el razonamiento por
-- persona vive aparte (tabla `matches`). Eso permite reejecutar el matching
-- sin volver a scrapear, y es lo que hace que el costo por usuario sea
-- marginal en vez de proporcional.
--
-- Idempotente: se puede correr las veces que haga falta.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Organizaciones: empresas, universidades, fundaciones, gobierno.
-- Habilita B2B2C y publicacion verificada sin tocar el resto del esquema.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orgs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('empresa', 'universidad', 'fundacion', 'gobierno')),
  plan        TEXT NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Personas. Se guarda el minimo indispensable: sin CV, sin documentos,
-- sin datos sensibles.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                 TEXT,
  carrera                TEXT NOT NULL,
  nivel_estudios         TEXT NOT NULL,
  intereses              TEXT[] NOT NULL DEFAULT '{}',
  ubicacion              TEXT NOT NULL,
  idiomas                JSONB NOT NULL DEFAULT '[]'::jsonb,
  org_id                 UUID REFERENCES orgs(id) ON DELETE SET NULL,
  -- Opt-in explicito para el matching inverso. Por defecto, invisible.
  visible_para_empresas  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indice global de oportunidades.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opportunities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo            TEXT NOT NULL,
  categoria         TEXT NOT NULL CHECK (categoria IN (
                      'beca', 'pasantia', 'empleo', 'intercambio',
                      'concurso', 'financiamiento', 'curso'
                    )),
  descripcion       TEXT,
  elegibilidad      TEXT,
  monto_beneficio   TEXT,
  -- Habilidades y requisitos como arreglo estructurado. Extraerlo durante la
  -- normalizacion cuesta un campo mas en el prompt; agregarlo despues obliga
  -- a reprocesar todo el historico.
  skills            TEXT[] NOT NULL DEFAULT '{}',

  fuente_nombre     TEXT NOT NULL,
  fuente_url        TEXT NOT NULL,
  link_aplicacion   TEXT,
  fecha_limite      DATE,

  confianza         TEXT NOT NULL DEFAULT 'por_validar'
                      CHECK (confianza IN ('verificada', 'por_validar', 'desactualizada')),
  -- 'descubierta' por el agente vs 'publicada' por una organizacion.
  origen            TEXT NOT NULL DEFAULT 'descubierta'
                      CHECK (origen IN ('descubierta', 'publicada')),
  org_id            UUID REFERENCES orgs(id) ON DELETE SET NULL,
  -- Una oportunidad patrocinada se marca en la interfaz y NUNCA altera su
  -- match_score ni su nivel de confianza.
  sponsored         BOOLEAN NOT NULL DEFAULT FALSE,

  estado            TEXT NOT NULL DEFAULT 'vigente'
                      CHECK (estado IN ('vigente', 'vencida')),
  -- Las vencidas no se borran: el historico habilita anticipar convocatorias
  -- que se repiten cada anio.
  hash_dedupe       TEXT NOT NULL UNIQUE,
  fecha_extraida    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_vigentes
  ON opportunities (estado, fecha_limite);
CREATE INDEX IF NOT EXISTS idx_opportunities_categoria
  ON opportunities (categoria);
CREATE INDEX IF NOT EXISTS idx_opportunities_skills
  ON opportunities USING GIN (skills);

-- ---------------------------------------------------------------------------
-- Resultado del razonamiento del agente, por persona.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  match_score     INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  por_que_calza   TEXT NOT NULL,
  elegible        BOOLEAN NOT NULL DEFAULT TRUE,
  estado          TEXT NOT NULL DEFAULT 'nuevo'
                    CHECK (estado IN ('nuevo', 'visto', 'guardado', 'descartado')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_ranking
  ON matches (user_id, match_score DESC);

-- ---------------------------------------------------------------------------
-- Telemetria de producto. Sin esto, los reportes de marca empleadora y de
-- impacto (RSE) no tienen que reportar.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  opportunity_id  UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('impresion', 'clic', 'guardado', 'descarte')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_oportunidad
  ON events (opportunity_id, tipo);

-- ---------------------------------------------------------------------------
-- Consentimientos. Revocables, con historial.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('visibilidad_empresas', 'notificaciones')),
  otorgado    BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consents_usuario
  ON consents (user_id, tipo, created_at DESC);

-- ---------------------------------------------------------------------------
-- Bitacora de corridas del agente. Es la prueba auditable de autonomia:
-- responde "y esto corre solo?" con datos, no con una promesa.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_runs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disparador             TEXT NOT NULL CHECK (disparador IN ('manual', 'cron')),
  user_id                UUID REFERENCES users(id) ON DELETE SET NULL,
  estado                 TEXT NOT NULL DEFAULT 'en_curso'
                           CHECK (estado IN ('en_curso', 'completada', 'fallida')),
  oportunidades_nuevas   INTEGER NOT NULL DEFAULT 0,
  matches_creados        INTEGER NOT NULL DEFAULT 0,
  error                  TEXT,
  started_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_recientes
  ON agent_runs (started_at DESC);
