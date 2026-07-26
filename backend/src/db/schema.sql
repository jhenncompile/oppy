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

  -- Los objetivos son la senal mas fuerte que recibe el agente: acotan que
  -- buscar antes de mirar cualquier otra cosa del perfil.
  --
  -- Es un arreglo porque los perfiles reales lo son: Diego busca pasantias Y
  -- becas Y hackathons. Pero acotado a 3 en la API — cada objetivo abre mas
  -- busquedas, y el descubrimiento es lo que cuesta. El primero pesa mas.
  objetivos              TEXT[] NOT NULL DEFAULT '{}',
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
ALTER TABLE users ADD COLUMN IF NOT EXISTS objetivos TEXT[] NOT NULL DEFAULT '{}';

-- El ALTER de arriba agrega la columna sin el CHECK que si trae el CREATE, asi
-- que una base migrada y una recien creada terminaban con reglas distintas para
-- la misma columna. Se reafirma aca para que las dos queden iguales.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_edad_check;
ALTER TABLE users ADD CONSTRAINT users_edad_check
  CHECK (edad IS NULL OR edad BETWEEN 14 AND 100);

-- objetivo (uno) -> objetivos (varios). Los perfiles reales persiguen mas de
-- una cosa a la vez; el valor que ya existia pasa a ser el primero, que es el
-- que mas pesa.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'objetivo'
  ) THEN
    UPDATE users SET objetivos = ARRAY[objetivo]
      WHERE objetivo IS NOT NULL AND cardinality(objetivos) = 0;
    ALTER TABLE users DROP COLUMN objetivo;
  END IF;
END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS experiencia TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS habilidades TEXT[] NOT NULL DEFAULT '{}';

-- `objetivos` es el unico campo enumerado del perfil, y hasta ahora la lista
-- valida solo existia en Zod. Todo lo que entra por otro lado — el seed, una
-- carga manual, el SQL Editor de Supabase — podia guardar un objetivo que el
-- orquestador no sabe traducir a categorias, y el perfil quedaba sin plan.
--
-- El tope de 3 va junto con la lista y no en otro lado: cada objetivo extra
-- abre mas busquedas, y el descubrimiento es lo que cuesta.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_objetivos_check;
ALTER TABLE users ADD CONSTRAINT users_objetivos_check
  CHECK (
    cardinality(objetivos) <= 3
    AND objetivos <@ ARRAY[
      'empleo', 'reinsercion', 'beca', 'curso',
      'crecimiento', 'voluntariado', 'evento'
    ]::text[]
  );
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
-- El reporte de alcance de una organizacion filtra por aca. Parcial porque la
-- enorme mayoria de las oportunidades son descubiertas y no tienen org.
CREATE INDEX IF NOT EXISTS idx_opportunities_org
  ON opportunities (org_id) WHERE org_id IS NOT NULL;

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

-- `RENAME COLUMN` no renombra el CHECK autogenerado, asi que una base migrada
-- y una recien creada terminaban con nombres distintos para la misma regla. No
-- rompe nada hoy, pero un DROP CONSTRAINT escrito contra la base nueva fallaria
-- en produccion.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_match_score_check' AND conrelid = 'matches'::regclass
  ) THEN
    ALTER TABLE matches
      RENAME CONSTRAINT matches_match_score_check TO matches_compatibilidad_check;
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
-- La libreta de cada persona: oportunidades que encontro por su cuenta.
--
-- Un aviso que llego por WhatsApp, un cartel en una puerta, un dato de una
-- conocida. En Bolivia esa es la mayor parte del mercado y no hay forma de
-- descubrirla scrapeando — pero la persona igual necesita seguirle el rastro.
--
-- Tabla APARTE del indice compartido, y la separacion es la feature:
--
--   1. Es privada. Nadie mas la ve. Si esto viviera dentro de `opportunities`
--      con un flag, cada consulta existente — findCandidatas, el listado
--      publico, los insights — tendria que acordarse de filtrar, y una sola
--      que se olvide expone lo que alguien anoto en privado.
--   2. No tiene `confianza`. El semaforo es una afirmacion de Oppy sobre una
--      fuente; sobre algo que la persona anoto, Oppy no afirma nada. Ponerle
--      color seria mentir en las dos direcciones.
--   3. No tiene compatibilidad ni razones. La persona ya decidio que le
--      interesa: no necesita que un modelo le diga cuanto calza.
--
-- `enlace` es nullable a proposito: el trabajo informal no tiene URL. Para eso
-- esta `donde`, que guarda en palabras de donde salio.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oportunidades_propias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titulo        TEXT NOT NULL,
  organizacion  TEXT,
  enlace        TEXT,
  donde         TEXT,
  notas         TEXT,
  fecha_limite  DATE,

  -- El mismo enum que `matches` menos 'nuevo' y 'visto': una oportunidad que
  -- la persona se tomo el trabajo de anotar ya nace en seguimiento.
  estado        TEXT NOT NULL DEFAULT 'guardado'
                  CHECK (estado IN (
                    'guardado', 'preparando', 'aplicada',
                    'entrevista', 'finalizada', 'descartado'
                  )),

  -- Idempotencia del recordatorio, en la fila y no en una tabla aparte: se
  -- avisa una sola vez por oportunidad, y avisar dos veces de lo mismo es
  -- exactamente como Oppy dejaria de ser un acompaniante.
  recordatorio_enviado_en TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_propias_persona
  ON oportunidades_propias (user_id, estado);
-- Parcial: el job de recordatorios solo mira las que todavia no avisaron.
CREATE INDEX IF NOT EXISTS idx_propias_pendientes
  ON oportunidades_propias (fecha_limite)
  WHERE recordatorio_enviado_en IS NULL;

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

-- --- Migracion de `notificaciones` -----------------------------------------
--
-- Hay dos avisos distintos sobre la misma oportunidad y no son el mismo hecho:
-- "encontre esto para vos" pasa una vez, cuando aparece; "esto cierra en tres
-- dias" pasa despues, cuando el plazo se acerca.
--
-- Con el UNIQUE original sobre (user_id, opportunity_id) el segundo aviso no
-- podia existir: a quien ya se le habia avisado del match nunca se le
-- recordaba el cierre. El tipo entra en la clave para que cada aviso tenga su
-- propia idempotencia.
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'match_alto';

ALTER TABLE notificaciones DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;
ALTER TABLE notificaciones ADD CONSTRAINT notificaciones_tipo_check
  CHECK (tipo IN ('match_alto', 'cierre_proximo'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notificaciones_user_id_opportunity_id_key'
      AND conrelid = 'notificaciones'::regclass
  ) THEN
    ALTER TABLE notificaciones DROP CONSTRAINT notificaciones_user_id_opportunity_id_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notificaciones_aviso_unico'
      AND conrelid = 'notificaciones'::regclass
  ) THEN
    ALTER TABLE notificaciones
      ADD CONSTRAINT notificaciones_aviso_unico UNIQUE (user_id, opportunity_id, tipo);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Codigos de acceso. Contrato en docs/12-auth.md.
--
-- Oppy no pide contrasenia: para volver a entrar desde otro dispositivo se
-- manda un codigo de 6 digitos al contacto que la persona ya dejo. Por eso no
-- hay tabla de sesiones ni de credenciales — esto es todo lo que hace falta.
--
-- Se guarda el HASH y nunca el codigo en claro: quien lea la base no debe poder
-- entrar a la cuenta de nadie. Seis digitos son 10^6 combinaciones, asi que el
-- limite de intentos es lo que sostiene la seguridad, no la longitud.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS codigos_acceso (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  codigo_hash TEXT NOT NULL,
  intentos    INTEGER NOT NULL DEFAULT 0,
  expira_en   TIMESTAMPTZ NOT NULL,
  usado_en    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_codigos_vigentes
  ON codigos_acceso (user_id, expira_en DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security.
--
-- Imprescindible en Supabase y neutro fuera de el. Supabase publica el esquema
-- `public` por PostgREST con una clave anonima pensada para vivir en el
-- navegador: sin RLS, el email y el telefono de cada persona quedan a un fetch
-- de distancia de cualquiera. Que Oppy guarde el minimo indispensable no sirve
-- de nada si ese minimo es publico.
--
-- Se activa SIN politicas a proposito. Oppy no usa PostgREST: se conecta por
-- protocolo Postgres con el rol dueño de las tablas, que esta exento de RLS.
-- Asi que "sin politicas" significa que no entra nadie mas y la aplicacion no
-- se entera.
--
-- La condicion es esa exencion: si algun dia la API se conecta con un rol
-- distinto del dueño de las tablas, RLS SI la afecta y hay que darle BYPASSRLS
-- o escribir politicas explicitas.
--
-- Idempotente: activar RLS sobre una tabla que ya lo tiene no hace nada.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tabla TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'orgs', 'users', 'opportunities', 'matches', 'oportunidades_propias',
    'events', 'consents', 'agent_runs', 'notificaciones', 'codigos_acceso'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabla);
  END LOOP;
END $$;
