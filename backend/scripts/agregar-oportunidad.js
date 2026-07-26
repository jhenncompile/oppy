/**
 * Agrega oportunidades a mano, sin correr el agente.
 *
 * Existe porque probar el calendario y las notificaciones necesita datos con
 * FECHAS CONTROLADAS, y el agente no sirve para eso: descubre lo que hay, que
 * casi nunca cierra hoy ni en tres dias. Ademas cuesta una corrida entera y
 * depende de Exa, Firecrawl y el modelo.
 *
 * `npm run seed` tampoco alcanza: inserta un catalogo fijo y sin upsert, asi
 * que correrlo dos veces duplica todo.
 *
 * Esto escribe por los mismos repositorios que el pipeline, asi que lo que
 * queda en la base es indistinguible de lo que descubre el agente — misma
 * deduplicacion por hash y mismo semaforo de confianza calculado por reglas.
 * No inventa el nivel de confianza: lo clasifica igual que en produccion.
 *
 * Uso:
 *   node scripts/agregar-oportunidad.js --demo --para maria@correo.com
 *   node scripts/agregar-oportunidad.js --titulo "Beca X" --cierra 3 --para <userId>
 *
 * Ver --ayuda para la lista completa.
 */
import { query, closePool } from '../src/db/index.js';
import * as opportunityRepository from '../src/repositories/opportunityRepository.js';
import * as matchRepository from '../src/repositories/matchRepository.js';
import { calcularHash } from '../src/services/agent/normalizer.js';
import { clasificar } from '../src/services/scoring/trust.js';

/**
 * Nombre de fuente por defecto y ancla de la limpieza.
 *
 * Todo lo que carga este script queda bajo este nombre para poder borrarlo
 * despues de un tirón. Importa mas de lo que parece: `limpiar-demo.js` solo
 * conoce los hashes del catalogo del seed, asi que sin esto las oportunidades
 * de prueba se quedarian en el indice para siempre, mezcladas con las reales y
 * sin forma de distinguirlas el dia de la demo.
 */
const FUENTE_MANUAL = 'Carga manual';

const CATEGORIAS = [
  'beca', 'pasantia', 'empleo', 'intercambio', 'concurso',
  'financiamiento', 'curso', 'voluntariado', 'evento', 'programa_social'
];

const ESTADOS = [
  'nuevo', 'visto', 'guardado', 'preparando', 'aplicada',
  'entrevista', 'finalizada', 'descartado'
];

/**
 * Un set chico que cubre los cuatro grupos del calendario: hoy, en 1 dia, esta
 * semana y mas adelante. Sin esto hay que calcular fechas a mano cada vez.
 */
const DEMO = [
  { titulo: 'Convocatoria de cierre inmediato — prueba', categoria: 'beca', dias: 0 },
  { titulo: 'Pasantia que cierra pronto — prueba', categoria: 'pasantia', dias: 1 },
  { titulo: 'Curso corto de esta semana — prueba', categoria: 'curso', dias: 4 },
  { titulo: 'Programa con plazo largo — prueba', categoria: 'empleo', dias: 12 }
];

function parsearArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const clave = argv[i].slice(2);
    const siguiente = argv[i + 1];
    if (!siguiente || siguiente.startsWith('--')) {
      args[clave] = true;
    } else {
      args[clave] = siguiente;
      i += 1;
    }
  }
  return args;
}

/** `--cierra 3` son tres dias desde hoy; `--cierra 2026-08-01` es esa fecha. */
function resolverFecha(valor) {
  if (valor === undefined || valor === true) return null;

  if (/^\d{1,3}$/.test(String(valor))) {
    const fecha = new Date();
    fecha.setHours(12, 0, 0, 0);
    fecha.setDate(fecha.getDate() + Number(valor));
    return fecha.toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) return String(valor);

  throw new Error(`--cierra no entiende "${valor}". Usa un numero de dias o YYYY-MM-DD.`);
}

/** Acepta un UUID, un correo o un pedazo del nombre. */
async function buscarPersona(referencia) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(referencia)) {
    const { rows } = await query('SELECT id, nombre, email, telefono, acepta_notificaciones FROM users WHERE id = $1', [referencia]);
    return rows[0] ?? null;
  }

  const { rows } = await query(
    `SELECT id, nombre, email, telefono, acepta_notificaciones
     FROM users
     WHERE lower(email) = lower($1) OR nombre ILIKE '%' || $1 || '%'
     ORDER BY created_at DESC
     LIMIT 1`,
    [referencia]
  );
  return rows[0] ?? null;
}

async function agregarUna({ titulo, categoria, fechaLimite, fuente, url, skills, descripcion }) {
  const hashDedupe = calcularHash(titulo, url);

  // El semaforo sale de las reglas de siempre, no de un valor puesto a mano:
  // una oportunidad de prueba con confianza inventada haria mentir a la
  // interfaz sobre lo unico que no puede mentir.
  const confianza = clasificar({ url, fechaLimite });

  const { oportunidad, esNueva } = await opportunityRepository.upsert({
    titulo,
    categoria,
    descripcion: descripcion ?? 'Cargada a mano para probar el calendario y los avisos.',
    elegibilidad: null,
    montoBeneficio: null,
    skills,
    fuente: { nombre: fuente, url },
    linkAplicacion: url,
    fechaLimite,
    confianza,
    origen: 'descubierta',
    sponsored: false,
    hashDedupe
  });

  return { oportunidad, esNueva, confianza };
}

/**
 * Borra todo lo cargado a mano. Los matches y las notificaciones se van con
 * ellas por las claves foraneas en cascada.
 */
async function limpiar() {
  const { rows } = await query(
    `SELECT o.titulo, count(m.id)::int AS matches
     FROM opportunities o
     LEFT JOIN matches m ON m.opportunity_id = o.id
     WHERE o.fuente_nombre = $1
     GROUP BY o.id, o.titulo
     ORDER BY o.titulo`,
    [FUENTE_MANUAL]
  );

  if (rows.length === 0) {
    console.log('\n  No hay nada cargado a mano.\n');
    return;
  }

  for (const fila of rows) {
    console.log(`  - ${fila.titulo} (${fila.matches} match${fila.matches === 1 ? '' : 'es'})`);
  }

  const { rowCount } = await query('DELETE FROM opportunities WHERE fuente_nombre = $1', [
    FUENTE_MANUAL
  ]);
  console.log(`\n  ${rowCount} borradas. Sus matches se fueron con ellas.\n`);
}

async function principal() {
  const args = parsearArgs(process.argv.slice(2));

  if (args.limpiar) return limpiar();

  if (args.ayuda || args.help || (!args.titulo && !args.demo)) {
    console.log(`
Agrega oportunidades sin correr el agente.

  --demo                Crea 4 con cierres escalonados: hoy, 1 dia, 4 dias y 12.
                        Cubre los cuatro grupos del calendario de una.

  --titulo   <texto>    Obligatorio si no usas --demo.
  --categoria <cat>     ${CATEGORIAS.join(', ')}
                        (por defecto: beca)
  --cierra   <n|fecha>  Numero de dias desde hoy, o YYYY-MM-DD.
  --fuente   <nombre>   Nombre de la fuente (por defecto: "Carga manual").
  --url      <url>      URL de la fuente. Define el nivel de confianza.
  --skills   <a,b,c>    Separadas por coma.

  --para     <persona>  A quien recomendarsela: UUID, correo o parte del nombre.
                        Sin esto la oportunidad entra al indice pero no le
                        aparece a nadie.
  --score    <0-100>    Compatibilidad del match (por defecto: 92).
  --estado   <estado>   ${ESTADOS.join(', ')}
                        (por defecto: guardado, que es lo que mira el calendario)

Ejemplos:
  node scripts/agregar-oportunidad.js --demo --para maria@correo.com
  node scripts/agregar-oportunidad.js --titulo "Beca Japon" --cierra 2 --para Maria --score 95
`);
    return;
  }

  const categoria = args.categoria === undefined || args.categoria === true ? 'beca' : args.categoria;
  if (!CATEGORIAS.includes(categoria)) {
    throw new Error(`Categoria "${categoria}" no existe. Validas: ${CATEGORIAS.join(', ')}`);
  }

  const estado = args.estado === undefined || args.estado === true ? 'guardado' : args.estado;
  if (!ESTADOS.includes(estado)) {
    throw new Error(`Estado "${estado}" no existe. Validos: ${ESTADOS.join(', ')}`);
  }

  const score = args.score === undefined || args.score === true ? 92 : Number(args.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error('--score tiene que ser un numero de 0 a 100.');
  }

  // Se resuelve la persona ANTES de escribir nada: fallar despues de insertar
  // deja el indice con basura a medias.
  let persona = null;
  if (args.para && args.para !== true) {
    persona = await buscarPersona(String(args.para));
    if (!persona) throw new Error(`No encontre a nadie con "${args.para}".`);
  }

  const fuente = args.fuente === undefined || args.fuente === true ? 'Carga manual' : args.fuente;
  const url = args.url === undefined || args.url === true
    ? 'https://ejemplo-carga-manual.local/oportunidad'
    : args.url;
  const skills = args.skills && args.skills !== true
    ? String(args.skills).split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const aCargar = args.demo
    ? DEMO.map((d) => ({
        titulo: d.titulo,
        categoria: d.categoria,
        fechaLimite: resolverFecha(String(d.dias)),
        fuente,
        url: `${url}#${d.dias}`,
        skills,
        descripcion: undefined
      }))
    : [{
        titulo: String(args.titulo),
        categoria,
        fechaLimite: resolverFecha(args.cierra),
        fuente,
        url,
        skills,
        descripcion: args.descripcion === true ? undefined : args.descripcion
      }];

  console.log('');
  for (const entrada of aCargar) {
    const { oportunidad, esNueva, confianza } = await agregarUna(entrada);

    console.log(`  ${esNueva ? '+ nueva  ' : '~ actualizada'} ${oportunidad.titulo}`);
    const cierre = oportunidad.fechaLimite ? new Date(oportunidad.fechaLimite).toISOString().slice(0, 10) : 'sin fecha';
    console.log(`      cierra: ${cierre} · confianza: ${confianza}`);

    if (persona) {
      const match = await matchRepository.upsert({
        userId: persona.id,
        opportunityId: oportunidad.id,
        compatibilidad: score,
        razones: [
          'Cargada a mano para probar el flujo',
          `Compatibilidad fijada en ${score}% desde el script`
        ],
        brechas: [],
        elegible: true
      });

      if (estado !== 'nuevo') await matchRepository.actualizarEstado(match.id, estado);
      console.log(`      match para ${persona.nombre ?? persona.email}: ${score}% · ${estado}`);
    }
  }

  if (persona) {
    console.log('');
    const puedeAvisar = persona.acepta_notificaciones && (persona.email || persona.telefono);
    if (puedeAvisar) {
      console.log(`  Zavu: ${persona.email ?? persona.telefono} tiene consentimiento.`);
      console.log('  Para disparar los avisos:      npm run cron');
      console.log('  Para los recordatorios de cierre: npm run recordatorios');
    } else {
      console.log('  Zavu NO va a avisar: esta persona no dio consentimiento o no dejo contacto.');
      console.log('  Se arregla desde Mi perfil > Volver a entrar, o en la tabla users.');
    }
  } else {
    console.log('');
    console.log('  Sin --para: entraron al indice pero no le aparecen a nadie todavia.');
  }
  console.log('');
}

principal()
  .catch((error) => {
    console.error(`\n  ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(closePool);
