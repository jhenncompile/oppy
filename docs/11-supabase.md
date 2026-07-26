# Fase 11 — La base en Supabase

Guía para quien sube la base. **Se puede seguir sin conocer el resto del
repositorio**: son ocho pasos y una verificación final.

El esquema ya está preparado — no hay que editar SQL a mano ni adaptar nada.

## Qué se sube y qué no

Se sube **solo la base de datos**. La API y el cron siguen corriendo donde
estén (local, Render, donde sea) y se conectan a Supabase por protocolo
Postgres, con `pg`, igual que a cualquier PostgreSQL.

**Oppy no usa el cliente de Supabase, ni PostgREST, ni Supabase Auth, ni
Storage.** No hay que instalar `@supabase/supabase-js` ni tocar el frontend. La
anon key y la service key no se usan en ninguna parte: si alguien las necesita,
algo se entendió al revés.

Todo el SQL de la aplicación vive en `backend/src/repositories/`. Ese es el
único lugar que habla con la base.

---

## Los ocho pasos

### 1. Crear el proyecto

En [supabase.com](https://supabase.com) → New project. Región **South America
(São Paulo)** si está disponible: es la más cercana a Bolivia y el pipeline hace
muchas escrituras cortas.

Guardar la contraseña de la base en ese momento. Supabase no la vuelve a
mostrar y regenerarla obliga a actualizarla en todos lados.

### 2. Aplicar el esquema

Copiar **todo** `backend/src/db/schema.sql` y pegarlo en el **SQL Editor** de
Supabase → Run.

Es un solo archivo, se aplica de una vez y es idempotente: correrlo dos veces no
cambia nada, así que si algo falla a la mitad se corrige y se vuelve a correr
entero.

> La alternativa es `npm run migrate` desde el backend con la `DATABASE_URL` ya
> configurada (paso 4). Hace exactamente lo mismo. El SQL Editor es preferible
> la primera vez porque muestra el error completo si algo falla.

Debe quedar así:

| Tablas (8) | |
|---|---|
| `orgs` | organizaciones que publican o patrocinan |
| `users` | personas — sin CV, sin documentos, sin datos sensibles |
| `opportunities` | el índice compartido de convocatorias |
| `matches` | el razonamiento del agente, por persona |
| `events` | telemetría de producto |
| `consents` | consentimientos, revocables y con historial |
| `agent_runs` | bitácora de corridas |
| `notificaciones` | envíos, con o sin éxito |

### 3. Verificar que RLS quedó activo

**Este paso no se saltea.** Supabase publica el esquema `public` por PostgREST
con una clave anónima pensada para vivir en el navegador. Sin RLS, el email y el
teléfono de cada persona quedan a un `fetch` de distancia de cualquiera.

`schema.sql` activa RLS sobre las ocho tablas, sin políticas. Eso no afecta a
Oppy — se conecta con el rol dueño de las tablas, que está exento — y cierra la
puerta a todo lo demás.

Para comprobarlo, en el SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Las ocho filas tienen que decir `true`. Si alguna dice `false`, el esquema no se
aplicó completo: volver al paso 2.

En el dashboard, la advertencia *"RLS disabled in public"* debe desaparecer.

### 4. Obtener la cadena de conexión

Project Settings → Database → Connection string → **Session pooler**.

**Session pooler, no la conexión directa.** La directa
(`db.<ref>.supabase.co`) solo resuelve por IPv6, y la mayoría de los hosts de
despliegue —Render entre ellos— no tienen salida IPv6: la conexión falla con
`ENETUNREACH` y el error no dice por qué.

Queda con esta forma:

```
postgresql://postgres.<ref>:<clave>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Si la contraseña tiene `@`, `:`, `/`, `#` o `?`, hay que **URL-encodearla** o la
cadena se parte mal. Lo más simple es usar una contraseña alfanumérica.

> El *Transaction pooler* (puerto `6543`) también sirve para la API, pero no
> para `npm run migrate`: el esquema se aplica como una sentencia múltiple con
> bloques `DO $$`, y eso conviene mandarlo por una conexión de sesión.

### 5. Configurar el backend

En `backend/.env`:

```bash
DATABASE_URL=postgresql://postgres.<ref>:<clave>@aws-0-<region>.pooler.supabase.com:5432/postgres
DATABASE_SSL=true
```

`DATABASE_SSL=true` es obligatorio. Sin eso la conexión se rechaza y el mensaje
tampoco es claro.

`npm run setup` detecta solo que el host es remoto: escribe `DATABASE_SSL=true`
y saltea la creación de la base, que en Supabase ya viene dada.

### 6. Probar la conexión

```bash
npm run migrate       # idempotente: si el paso 2 salió bien, no hace nada
npm run dev:api       # y abrir http://localhost:3001/health
```

Si `/health` responde `{"estado":"ok"}` y `GET /api/opportunities` devuelve una
lista vacía en vez de un error, la base está bien conectada.

### 7. Sembrar perfiles de prueba (opcional)

```bash
npm run seed
```

Crea tres perfiles demo — estudiante, recién egresada y reinserción laboral —
con objetivos, experiencia, habilidades y restricciones completos, que es lo que
el agente necesita para armar un plan de búsqueda.

**El seed inserta sin upsert: correrlo dos veces duplica los perfiles.** Si pasa,
se limpia con `delete from users where nombre like 'Demo — %';`.

### 8. Configurar el despliegue

`render.yaml` ya no provisiona base propia: `DATABASE_URL` es un secreto que se
carga en el dashboard de Render, con `DATABASE_SSL=true` ya fijado.

**La API y el cron tienen que apuntar a la MISMA base.** El índice de
oportunidades es compartido: el cron descubre una vez para todos y el matching
por persona se calcula sobre lo ya indexado. Dos bases significan que el cron
llena una y la API lee otra vacía.

---

## Verificación final

Cinco consultas en el SQL Editor. Si las cinco dan lo esperado, la base quedó
lista:

```sql
-- 1. Las ocho tablas existen
select count(*) from information_schema.tables
where table_schema = 'public';                          -- 8

-- 2. RLS activo en todas
select count(*) from pg_tables
where schemaname = 'public' and rowsecurity;            -- 8

-- 3. Los indices que sostienen las consultas calientes
select indexname from pg_indexes
where schemaname = 'public' order by indexname;         -- 7 idx_* + los de PK/UNIQUE

-- 4. Las reglas de dominio viajaron con el esquema
select conname from pg_constraint
where conrelid = 'users'::regclass and contype = 'c';   -- incluye users_objetivos_check

-- 5. Escritura y lectura reales
insert into orgs (nombre, tipo) values ('Prueba', 'fundacion') returning id;
delete from orgs where nombre = 'Prueba';
```

---

## Cosas que conviene saber antes de que muerdan

**`pgcrypto`.** El esquema abre con `CREATE EXTENSION IF NOT EXISTS pgcrypto`.
En Supabase ya está instalada, así que es un no-op. Y `gen_random_uuid()` es
nativo desde PostgreSQL 13, con lo cual los IDs funcionan aunque la extensión no
estuviera.

**El plan free se pausa.** Un proyecto sin actividad por una semana entra en
pausa y hay que despertarlo desde el dashboard. Para una demo con jurado, vale
la pena entrar el día anterior y confirmar que responde.

**Límite de conexiones.** El backend abre hasta 10 conexiones por proceso
(`backend/src/db/index.js`). Con la API y el cron son 20, muy por debajo de lo
que aguanta el pooler. Si algún día se agregan más procesos, ese es el número a
mirar.

**Migraciones futuras.** `schema.sql` es idempotente por diseño: los cambios se
expresan como `ALTER ... IF NOT EXISTS` o bloques `DO $$` que comprueban su
propia condición, y se aplican corriendo el archivo entero de nuevo. **No usar
el sistema de migraciones de Supabase en paralelo** — serían dos fuentes de
verdad para el mismo esquema. Cuando haga falta un cambio destructivo, hay que
versionar de verdad, y eso amerita un spec.

**Backups.** El plan free no los hace automáticamente. Lo que duele perder son
`users` y `matches`; `opportunities` se puede reconstruir con una corrida del
cron.

---

## Si algo falla

| Síntoma | Causa | Arreglo |
|---|---|---|
| `ENETUNREACH` / `EHOSTUNREACH` | Se usó la conexión directa (IPv6) | Cambiar a la cadena del Session pooler |
| `no pg_hba.conf entry ... no encryption` | Falta SSL | `DATABASE_SSL=true` |
| `password authentication failed` | Contraseña con caracteres sin encodear | URL-encodear la contraseña |
| `permission denied for schema public` | Se usó una key de API en vez de la cadena Postgres | Usar la connection string, no la anon key |
| La app anda pero devuelve 0 filas donde debería haber datos | La API y el cron apuntan a bases distintas | Misma `DATABASE_URL` en los dos servicios |
| `relation "users" does not exist` | El esquema no se aplicó | Repetir el paso 2 |
