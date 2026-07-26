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
  edad                   INTEGER CHECK (edad IS NULL OR edad BETWEEN 14 AND 100),
  carrera                TEXT NOT NULL,
  nivel_estudios         TEXT NOT NULL,
  intereses              TEXT[] NOT NULL DEFAULT '{}',
  ubicacion              TEXT NOT NULL,
  idiomas                JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- El objetivo es la senal mas fuerte que recibe el agente: acota que buscar
  -- antes de mirar cualquier otra cosa del perfil.
  objetivo               TEXT,
  -- 'experiencia_familiar' entra a proposito: para mucha gente veinte anios
  -- administrando una casa SON experiencia administrativa, y ningun formulario
  -- tradicional se lo reconoce.
  experiencia            TEXT[] NOT NULL DEFAULT '{}',
  habilidades            TEXT[] NOT NULL DEFAULT '{}',
  -- Una convocatoria que cumple todos los requisitos pero queda fuera del radio
  -- o del horario no es una oportunidad. Sin esto el agente no puede saberlo.
  preferencias           JSONB NOT NULL DEFAULT '{}'::jsonb,
  restricciones          TEXT[] NOT NULL DEFAULT '{}',

  -- Contacto para las notificaciones. Opcional: sin esto la persona usa Oppy
  -- igual, solo que no recibe avisos.
  email                  TEXT,
  telefono               TEXT,
  acepta_notificaciones  BOOLEAN NOT NULL DEFAULT FALSE,

  org_id                 UUID REFERENCES orgs(id) ON DELETE SET NULL,
  -- Opt-in explicito para el matching inverso. Por defecto, invisible.
  visible_para_empresas  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- Migracion de `users` --------------------------------------------------
-- Ver la nota de `matches` mas abajo: los CREATE son no-ops sobre una base que
-- ya existe, asi que todo cambio posterior vive en un ALTER idempotente.
ALTER TABLE users ADD COLUMN IF NOT EXISTS edad INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS objetivo TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS experiencia TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS habilidades TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferencias JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS restricciones TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS acepta_notificaciones BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- Indice global de oportunidades.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opportunities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo            TEXT NOT NULL,
  categoria         TEXT NOT NULL CHECK (categoria IN (
                      'beca', 'pasantia', 'empleo', 'intercambio',
                      'concurso', 'financiamiento', 'curso',
                      'voluntariado', 'evento', 'programa_social'
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
  -- compatibilidad ni su nivel de confianza.
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
  compatibilidad  INTEGER NOT NULL CHECK (compatibilidad BETWEEN 0 AND 100),
  -- Razones y brechas son arreglos, no prosa: el usuario las lee escaneando y
  -- las brechas alimentan el checklist de la oportunidad. Guardarlas como un
  -- parrafo obligaria a volver a partirlas en la interfaz.
  razones         TEXT[] NOT NULL DEFAULT '{}',
  brechas         TEXT[] NOT NULL DEFAULT '{}',
  elegible        BOOLEAN NOT NULL DEFAULT TRUE,
  -- El estado avanza: guardada -> preparando -> aplicada -> entrevista ->
  -- finalizada. 'descartado' se puede elegir en cualquier momento y es
  -- terminal: si la persona ya dijo que no, no se le vuelve a ofrecer.
  estado          TEXT NOT NULL DEFAULT 'nuevo'
                    CHECK (estado IN (
                      'nuevo', 'visto', 'guardado', 'preparando',
                      'aplicada', 'entrevista', 'finalizada', 'descartado'
                    )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);

-- --- Migracion de `matches` ------------------------------------------------
--
-- El CREATE de arriba es un no-op sobre una base que ya existe, asi que un
-- cambio sobre una tabla ya creada tiene que venir aca. Cada bloque comprueba
-- su propia condicion: aplicar el esquema dos veces no cambia nada.
--
-- Va ANTES del indice a proposito. Postgres resuelve las columnas al analizar
-- un CREATE INDEX, incluso con IF NOT EXISTS, asi que si el renombre corriera
-- despues, el indice fallaria contra una base vieja.
--
-- Cuando el esquema necesite cambios que no se puedan expresar asi, toca
-- versionar de verdad.

-- match_score -> compatibilidad
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'match_score'
  ) THEN
    ALTER TABLE matches RENAME COLUMN match_score TO compatibilidad;
  END IF;
END $$;

-- por_que_calza (prosa) -> razones (arreglo). El texto que ya existia se
-- conserva como un unico elemento: perderlo obligaria a repuntuar todo.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'por_que_calza'
  ) THEN
    ALTER TABLE matches ADD COLUMN IF NOT EXISTS razones TEXT[] NOT NULL DEFAULT '{}';
    UPDATE matches SET razones = ARRAY[por_que_calza]
      WHERE por_que_calza IS NOT NULL AND cardinality(razones) = 0;
    ALTER TABLE matches DROP COLUMN por_que_calza;
  END IF;
END $$;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS razones TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS brechas TEXT[] NOT NULL DEFAULT '{}';

-- Estados de seguimiento. Se reemplaza el CHECK entero porque ampliarlo no se
-- puede expresar de otra forma.
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_estado_check;
ALTER TABLE matches ADD CONSTRAINT matches_estado_check
  CHECK (estado IN (
    'nuevo', 'visto', 'guardado', 'preparando',
    'aplicada', 'entrevista', 'finalizada', 'descartado'
  ));

-- Categorias nuevas: voluntariado, evento y programa social.
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_categoria_check;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_categoria_check
  CHECK (categoria IN (
    'beca', 'pasantia', 'empleo', 'intercambio',
    'concurso', 'financiamiento', 'curso',
    'voluntariado', 'evento', 'programa_social'
  ));

CREATE INDEX IF NOT EXISTS idx_matches_ranking
  ON matches (user_id, compatibilidad DESC);

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

-- ---------------------------------------------------------------------------
-- Notificaciones enviadas.
--
-- El UNIQUE es el mecanismo de idempotencia, no un detalle: sin el, cada
-- corrida del cron reenviaria las mismas oportunidades y Oppy pasaria de
-- acompaniante a spam en un dia.
--
-- Los fallos tambien se guardan. Un envio que no salio es informacion: sin
-- registrarlo no hay forma de saber si el canal esta caido o si nunca se
-- intento.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id  UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  canal           TEXT,
  estado          TEXT NOT NULL CHECK (estado IN ('enviado', 'fallido')),
  mensaje_id      TEXT,
  error           TEXT,
  enviado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_recientes
  ON notificaciones (user_id, enviado_en DESC);
