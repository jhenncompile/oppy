#!/usr/bin/env node
/**
 * Herramienta local de Oppy: un menu con las tres cosas que hace falta hacer
 * para trabajar en el proyecto.
 *
 *   1) Preparar el entorno — .env, base de datos, esquema, datos demo
 *   2) Levantar el backend
 *   3) Levantar el frontend
 *   4) Probar una notificacion por Zavu
 *   5) Correr el agente ahora (la misma corrida que el cron)
 *
 * Backend y frontend son opciones separadas a proposito: son dos servicios
 * distintos tambien en despliegue (Render y Netlify), y separados se reinicia
 * o se leen los logs de uno sin tocar el otro. Se levantan en dos terminales,
 * cada una con este menu abierto.
 *
 * Tambien acepta la opcion directa, para no pasar por el menu:
 *
 *   node scripts/oppy.mjs preparar
 *   node scripts/oppy.mjs backend
 *   node scripts/oppy.mjs frontend
 *   node scripts/oppy.mjs agente
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const SERVICIOS = {
  backend: { dir: join(raiz, 'backend'), etiqueta: 'backend', url: 'http://localhost:3001' },
  frontend: { dir: join(raiz, 'frontend'), etiqueta: 'frontend', url: 'http://localhost:5173' }
};

// --- Presentacion ---------------------------------------------------------

const c = {
  gris: (t) => `\x1b[90m${t}\x1b[0m`,
  verde: (t) => `\x1b[32m${t}\x1b[0m`,
  ambar: (t) => `\x1b[33m${t}\x1b[0m`,
  rojo: (t) => `\x1b[31m${t}\x1b[0m`,
  cian: (t) => `\x1b[36m${t}\x1b[0m`,
  fuerte: (t) => `\x1b[1m${t}\x1b[0m`
};

const ok = (t) => console.log(`  ${c.verde('✔')} ${t}`);
const nota = (t) => console.log(`  ${c.gris(t)}`);
const aviso = (t) => console.log(`  ${c.ambar('!')} ${t}`);
const error = (t) => console.log(`  ${c.rojo('✖')} ${t}`);

// --- Utilidades -----------------------------------------------------------

/** npm en Windows es un .cmd: Node exige shell para ejecutarlo. */
const conShell = process.platform === 'win32';

/** Ejecuta un comando y devuelve el codigo de salida, sin lanzar. */
function ejecutar(comando, args, cwd, stdio = 'inherit') {
  return new Promise((resolve, reject) => {
    const hijo = spawn(comando, args, { cwd, stdio, shell: conShell });
    hijo.on('error', reject);
    hijo.on('close', (codigo) => resolve(codigo ?? 1));
  });
}

const npmCodigo = (args, cwd, stdio) => ejecutar('npm', args, cwd, stdio);

/** Igual, pero un codigo distinto de cero es un fallo del paso. */
async function npm(args, cwd) {
  const codigo = await npmCodigo(args, cwd);
  if (codigo !== 0) throw new Error(`\`npm ${args.join(' ')}\` termino con codigo ${codigo}`);
}

/**
 * Sin terminal (CI, salida redirigida) no hay a quien preguntarle: se toma el
 * valor por defecto en vez de quedarse esperando una respuesta que no va a
 * llegar. Lo mismo si el usuario cierra la entrada con Ctrl+D.
 */
function preguntar(texto, { defecto = '', oculto = false, sangria = '  ' } = {}) {
  if (!process.stdin.isTTY) return Promise.resolve(defecto);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pista = oculto ? '••••••' : defecto;
  const etiqueta = `${sangria}${texto}${defecto ? ` ${c.gris(`[${pista}]`)}` : ''}: `;

  return new Promise((resolve) => {
    let mudo = false;
    let respondido = false;

    if (oculto) rl._writeToOutput = (str) => { if (!mudo) rl.output.write(str); };

    rl.on('close', () => {
      if (!respondido) resolve(defecto);
    });

    rl.question(etiqueta, (respuesta) => {
      respondido = true;
      if (oculto) rl.output.write('\n');
      rl.close();
      resolve(respuesta.trim() || defecto);
    });

    mudo = true;
  });
}

/** Lee un .env sin depender de dotenv, que puede no estar instalado todavia. */
function leerEnv(ruta) {
  const valores = {};
  if (!existsSync(ruta)) return valores;
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const corte = limpia.indexOf('=');
    if (corte === -1) continue;
    valores[limpia.slice(0, corte).trim()] = limpia.slice(corte + 1).trim();
  }
  return valores;
}

const preparado = () =>
  Object.values(SERVICIOS).every(
    (s) => existsSync(join(s.dir, '.env')) && existsSync(join(s.dir, 'node_modules'))
  );

// =========================================================================
// Opcion 1 — Preparar el entorno
// =========================================================================

/**
 * Idempotente a proposito: se puede elegir las veces que haga falta. No pisa
 * un .env existente, no recrea la base si ya esta, y no vuelve a sembrar si
 * ya hay perfiles. Cada paso se anuncia antes de correr, asi que si algo
 * falla se ve en cual y con que comando manual se reproduce.
 */
async function preparar() {
  let paso = 0;
  const titulo = (t) => console.log(`\n${c.fuerte(`[${++paso}/7] ${t}`)}`);

  console.log(c.fuerte('\nPreparando el entorno local'));

  // 1. Node -----------------------------------------------------------------
  titulo('Verificando Node');
  const mayor = Number(process.versions.node.split('.')[0]);
  if (mayor < 20) throw new Error(`Se requiere Node 20 o superior. Tienes ${process.version}.`);
  ok(`Node ${process.version}`);

  // 2. Dependencias ---------------------------------------------------------
  titulo('Instalando dependencias');
  nota('npm install --prefix backend && npm install --prefix frontend');
  await npm(['install'], SERVICIOS.backend.dir);
  await npm(['install'], SERVICIOS.frontend.dir);
  ok('backend y frontend listos');

  // 3. Entorno --------------------------------------------------------------
  titulo('Configurando el entorno');
  const envBackend = join(SERVICIOS.backend.dir, '.env');
  const envFrontend = join(SERVICIOS.frontend.dir, '.env');

  if (existsSync(envBackend)) {
    ok('backend/.env ya existe, se respeta');
    const { DATABASE_URL: actual = '' } = leerEnv(envBackend);
    nota(`DATABASE_URL apunta a ${actual.replace(/:\/\/[^@]*@/, '://***@') || '(vacio)'}`);
    const rehacer = await preguntar('Reescribirlo? (s/N)', { defecto: 'n' });
    if (rehacer.toLowerCase().startsWith('s')) await escribirEnvBackend(envBackend);
  } else {
    await escribirEnvBackend(envBackend);
  }

  if (existsSync(envFrontend)) {
    ok('frontend/.env ya existe, se respeta');
  } else {
    writeFileSync(envFrontend, readFileSync(join(SERVICIOS.frontend.dir, '.env.example'), 'utf8'));
    ok('frontend/.env escrito (VITE_API_URL vacio: Vite hace proxy al backend)');
  }

  const { DATABASE_URL } = leerEnv(envBackend);
  if (!DATABASE_URL) throw new Error('backend/.env no define DATABASE_URL');

  // 4. Base -----------------------------------------------------------------
  titulo('Preparando la base de datos');
  const pg = await asegurarBase(DATABASE_URL);

  // 5. Esquema y datos ------------------------------------------------------
  titulo('Aplicando el esquema');
  nota('npm run migrate --prefix backend');
  await npm(['run', 'migrate'], SERVICIOS.backend.dir);
  await sembrarSiHaceFalta(pg, DATABASE_URL);

  // 6. Modelo ---------------------------------------------------------------
  titulo('Revisando el modelo local');
  await revisarOllama(leerEnv(envBackend));

  // 7. Notificaciones -------------------------------------------------------
  titulo('Revisando las notificaciones');
  await revisarZavu(leerEnv(envBackend));

  console.log(`\n${c.verde('Entorno listo.')} Ahora las opciones 2 y 3, cada una en su terminal.`);
}

async function escribirEnvBackend(destino) {
  nota('La contrasena no se muestra al escribirla y queda solo en backend/.env,');
  nota('que esta en .gitignore.');

  const usuario = await preguntar('Usuario de PostgreSQL', { defecto: 'postgres' });
  const clave = await preguntar('Contrasena', { defecto: 'postgres', oculto: true });
  const host = await preguntar('Host', { defecto: 'localhost' });
  const puerto = await preguntar('Puerto', { defecto: '5432' });
  const base = await preguntar('Nombre de la base', { defecto: 'oppy' });

  const url = `postgresql://${encodeURIComponent(usuario)}:${encodeURIComponent(clave)}@${host}:${puerto}/${base}`;
  const plantilla = readFileSync(join(SERVICIOS.backend.dir, '.env.example'), 'utf8');

  writeFileSync(destino, plantilla.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url}`));
  ok(`backend/.env escrito (base "${base}" en ${host}:${puerto})`);
}

/**
 * Crea la base si falta, conectandose a `postgres` — la base de mantenimiento
 * que siempre existe. Usa el cliente pg del backend en vez de psql, que en
 * Windows rara vez esta en el PATH.
 */
async function asegurarBase(databaseUrl) {
  const require = createRequire(join(SERVICIOS.backend.dir, 'package.json'));
  const pg = require('pg');

  const destino = new URL(databaseUrl);
  const nombre = decodeURIComponent(destino.pathname.slice(1));

  const admin = new URL(databaseUrl);
  admin.pathname = '/postgres';

  const cliente = new pg.Client({ connectionString: admin.toString() });

  try {
    await cliente.connect();
  } catch (fallo) {
    throw new Error(
      `No se pudo conectar a PostgreSQL en ${destino.host} — ${fallo.message}\n` +
      '  Revisa que el servicio este corriendo y que el usuario y la contrasena\n' +
      '  de backend/.env sean correctos. La opcion 1 permite reescribirlo.'
    );
  }

  try {
    const { rowCount } = await cliente.query(
      'select 1 from pg_database where datname = $1',
      [nombre]
    );
    if (rowCount) {
      ok(`la base "${nombre}" ya existe`);
    } else {
      await cliente.query(`CREATE DATABASE "${nombre.replace(/"/g, '""')}"`);
      ok(`base "${nombre}" creada`);
    }
  } finally {
    await cliente.end();
  }

  return pg;
}

/**
 * `seed` inserta sin upsert: sembrar dos veces duplicaria los perfiles de
 * prueba. Por eso se mira antes si la tabla ya tiene algo.
 */
async function sembrarSiHaceFalta(pg, databaseUrl) {
  const cliente = new pg.Client({ connectionString: databaseUrl });
  await cliente.connect();
  let perfiles;
  try {
    const { rows } = await cliente.query('select count(*)::int as n from users');
    perfiles = rows[0].n;
  } finally {
    await cliente.end();
  }

  if (perfiles > 0) {
    ok(`ya hay ${perfiles} perfil(es), se omite el seed`);
    nota('para sembrar igual: npm run seed --prefix backend');
    return;
  }

  nota('npm run seed --prefix backend');
  await npm(['run', 'seed'], SERVICIOS.backend.dir);
  ok('3 perfiles demo creados');
}

/**
 * El LLM no bloquea el arranque: la API y el dashboard levantan sin el. Lo que
 * falla sin modelo es el pipeline del agente — normalizacion y scoring.
 */
async function revisarOllama({ OLLAMA_URL = 'http://localhost:11434', OLLAMA_MODEL = 'llama3.1:8b' }) {
  try {
    const respuesta = await fetch(new URL('/api/tags', OLLAMA_URL), {
      signal: AbortSignal.timeout(3000)
    });
    const { models = [] } = await respuesta.json();
    const nombres = models.map((m) => m.name);

    if (nombres.includes(OLLAMA_MODEL)) {
      ok(`Ollama responde con "${OLLAMA_MODEL}"`);
    } else {
      aviso(`Ollama responde, pero no tiene "${OLLAMA_MODEL}".`);
      nota(`ollama pull ${OLLAMA_MODEL}`);
      if (nombres.length) nota(`modelos disponibles: ${nombres.join(', ')}`);
    }
  } catch {
    aviso(`Ollama no responde en ${OLLAMA_URL}.`);
    nota('La API y el dashboard funcionan igual; lo que falla sin modelo es');
    nota('POST /api/agent/run (normalizacion y scoring).');
    nota(`Para habilitarlo: ollama serve  &&  ollama pull ${OLLAMA_MODEL}`);
  }
}

/**
 * Zavu no bloquea nada: sin clave, el modulo de notificaciones se degrada solo
 * y registra el intento como fallido, igual que Exa y Firecrawl. Pero conviene
 * decirlo fuerte, porque es un entregable del track y es facil olvidarlo.
 *
 * No alcanza con mirar si la variable esta escrita: una clave vencida o una
 * cuenta sin saldo se ven exactamente igual que una que funciona, y el fallo
 * recien aparece cuando el cron intenta avisar. Por eso se consulta la cuenta —
 * `me` y `balance` no envian nada.
 */
async function revisarZavu({ ZAVUDEV_API_KEY = '', NOTIF_MATCH_THRESHOLD = '80' }) {
  if (ZAVUDEV_API_KEY.length === 0) {
    aviso('ZAVUDEV_API_KEY vacia: no se envian notificaciones.');
    nota('El resto de Oppy funciona igual; los intentos quedan como fallidos');
    nota('en la tabla `notificaciones`.');
    nota('Conseguila en https://zavu.dev y ponela en backend/.env');
    return;
  }

  const require = createRequire(join(SERVICIOS.backend.dir, 'package.json'));

  let cliente;
  try {
    const modulo = require('@zavudev/sdk');
    const Zavudev = modulo.default ?? modulo;
    cliente = new Zavudev({ apiKey: ZAVUDEV_API_KEY });
  } catch {
    aviso('El SDK de Zavu no esta instalado. Volve a correr esta opcion.');
    return;
  }

  let cuenta;
  try {
    cuenta = await cliente.me.retrieve();
  } catch (fallo) {
    aviso(`La clave de Zavu no funciona — ${fallo.message}`);
    nota('Revisala en https://zavu.dev y actualiza backend/.env');
    return;
  }

  const modo = cuenta?.isTestMode ? 'modo prueba' : 'modo real';
  ok(`Zavu responde (${cuenta?.team?.name ?? 'sin equipo'}, ${modo})`);
  nota(`Se avisa a partir de ${NOTIF_MATCH_THRESHOLD}% de compatibilidad`);

  // El saldo es lo que mas silenciosamente rompe una demo: la clave es valida,
  // la configuracion es correcta, y el envio falla igual.
  try {
    const saldo = await cliente.balance.retrieve();
    if (typeof saldo?.balance === 'number' && saldo.balance <= 0 && !saldo.creditLimit) {
      aviso(`Saldo en ${saldo.balance} ${(saldo.currency ?? '').toUpperCase()}: los envios pueden fallar.`);
      nota('Cargar credito antes de demostrar las notificaciones en vivo.');
    }
  } catch {
    // El saldo es informativo: no saberlo no invalida la configuracion.
  }

  nota('Para confirmar con un envio real: opcion 4 del menu');
}

// =========================================================================
// Opcion 4 — Probar una notificacion
// =========================================================================

/**
 * Envio real contra un destinatario de verdad. Es el paso que hay que haber
 * hecho antes del pitch: si el canal falla, es mucho mejor enterarse aca que
 * frente al jurado.
 */
async function probarNotificacion() {
  const envBackend = join(SERVICIOS.backend.dir, '.env');

  if (!existsSync(envBackend)) {
    error('Falta backend/.env. Corre primero la opcion 1.');
    return;
  }

  const { ZAVUDEV_API_KEY = '' } = leerEnv(envBackend);
  if (!ZAVUDEV_API_KEY) {
    error('ZAVUDEV_API_KEY esta vacia en backend/.env.');
    nota('Conseguila en https://zavu.dev');
    return;
  }

  console.log(`\n${c.fuerte('Probar una notificacion')}`);
  nota('Zavu detecta el canal por el formato: un correo sale por email,');
  nota('un telefono en formato internacional por SMS o Telegram.');

  const destinatario = await preguntar('A donde la mando');
  if (!destinatario) {
    error('Sin destinatario no hay nada que enviar.');
    return;
  }

  await ejecutar('node', ['scripts/test-zavu.js', destinatario], SERVICIOS.backend.dir);
}

// =========================================================================
// Opcion 5 — Corrida del agente
// =========================================================================

/**
 * La misma corrida que dispara el cron, en un proceso aparte. Sirve para dejar
 * el indice poblado ANTES del pitch: asi la demo en vivo solo hace matching —
 * rapido y a prueba de la red del evento.
 */
async function correrAgente() {
  if (!existsSync(join(SERVICIOS.backend.dir, '.env'))) {
    error('Falta backend/.env. Corre primero la opcion 1.');
    return;
  }

  console.log(`\n${c.fuerte('Corrida del agente')}`);
  nota('Descubre, normaliza, puntua y notifica. Es lo mismo que hace el cron.');
  nota('npm run cron --prefix backend\n');

  const codigo = await npmCodigo(['run', 'cron'], SERVICIOS.backend.dir);
  if (codigo === 0) ok('Corrida terminada');
  else error(`La corrida termino con codigo ${codigo}`);
}

// =========================================================================
// Opcion 6 — Limpiar los datos de ejemplo
// =========================================================================

/**
 * El catalogo de demo entra al indice compartido por la misma puerta que lo
 * descubierto, con nombres de fuente autenticos y semaforo real. Una vez
 * adentro es indistinguible de una convocatoria de verdad, y apagar DEMO_MODE
 * no lo borra.
 *
 * Hay que correr esto antes de cualquier demo con fuentes reales.
 */
async function limpiarDemo() {
  if (!existsSync(join(SERVICIOS.backend.dir, '.env'))) {
    error('Falta backend/.env. Corre primero la opcion 1.');
    return;
  }

  console.log(`\n${c.fuerte('Limpiar datos de ejemplo')}`);

  // Primero se muestra que se va a borrar. Borrar sin mirar es como se pierde
  // el indice entero cinco minutos antes de un pitch.
  await ejecutar('node', ['scripts/limpiar-demo.js'], SERVICIOS.backend.dir);

  const respuesta = await preguntar('Confirmas el borrado? (s/N)', { defecto: 'n' });
  if (!respuesta.toLowerCase().startsWith('s')) {
    nota('No se borro nada.');
    return;
  }

  await ejecutar('node', ['scripts/limpiar-demo.js', '--si'], SERVICIOS.backend.dir);
}

// =========================================================================
// Opciones 2 y 3 — Levantar cada servicio
// =========================================================================

/**
 * Cede la terminal al servidor de desarrollo. Ctrl+C lo baja y devuelve al
 * menu: mientras el hijo corre, el padre ignora la senal para no morir con el.
 */
async function levantar(clave) {
  const servicio = SERVICIOS[clave];

  if (!existsSync(join(servicio.dir, 'node_modules'))) {
    error(`Faltan dependencias en ${servicio.etiqueta}. Corre primero la opcion 1.`);
    return;
  }
  if (!existsSync(join(servicio.dir, '.env'))) {
    error(`Falta ${servicio.etiqueta}/.env. Corre primero la opcion 1.`);
    return;
  }

  console.log(`\n${c.fuerte(`Levantando ${servicio.etiqueta}`)} ${c.cian(servicio.url)}`);
  nota('Ctrl+C baja el servicio y vuelve al menu.\n');

  let interrumpido = false;
  const ignorar = () => { interrumpido = true; };
  process.on('SIGINT', ignorar);

  try {
    const codigo = await npmCodigo(['run', 'dev'], servicio.dir);
    if (codigo !== 0 && !interrumpido) {
      error(`${servicio.etiqueta} termino con codigo ${codigo}.`);
    } else {
      console.log(`\n  ${c.gris(`${servicio.etiqueta} detenido.`)}`);
    }
  } finally {
    process.off('SIGINT', ignorar);
  }
}

// =========================================================================
// Menu
// =========================================================================

const OPCIONES = {
  1: { alias: 'preparar', texto: 'Preparar el entorno', detalle: '.env, base de datos, esquema, datos demo', accion: preparar },
  2: { alias: 'backend', texto: 'Levantar el backend', detalle: 'http://localhost:3001', accion: () => levantar('backend') },
  3: { alias: 'frontend', texto: 'Levantar el frontend', detalle: 'http://localhost:5173', accion: () => levantar('frontend') },
  4: { alias: 'notificacion', texto: 'Probar una notificacion', detalle: 'envio real por Zavu', accion: probarNotificacion },
  5: { alias: 'agente', texto: 'Correr el agente ahora', detalle: 'la misma corrida que el cron', accion: correrAgente },
  6: { alias: 'limpiar', texto: 'Limpiar datos de ejemplo', detalle: 'saca el catalogo demo del indice', accion: limpiarDemo }
};

function encabezado() {
  console.log(`\n${c.fuerte('Oppy — entorno local')}`);
  console.log(
    preparado()
      ? c.gris('  entorno preparado')
      : c.ambar('  entorno sin preparar — empieza por la opcion 1')
  );
  console.log('');
  for (const [numero, opcion] of Object.entries(OPCIONES)) {
    console.log(`  ${c.fuerte(numero)}) ${opcion.texto.padEnd(22)} ${c.gris(opcion.detalle)}`);
  }
  console.log(`  ${c.fuerte('0')}) Salir\n`);
  console.log(c.gris('  El backend y el frontend van en terminales separadas:'));
  console.log(c.gris('  abre esta herramienta en cada una y elige 2 en una, 3 en la otra.\n'));
  console.log(c.gris('  Antes del pitch: 5 para dejar el indice poblado, 4 para confirmar'));
  console.log(c.gris('  que el canal de notificaciones funciona.\n'));
}

async function menu() {
  for (;;) {
    encabezado();
    const eleccion = await preguntar('Opcion', { defecto: '0' });

    if (eleccion === '0' || eleccion.toLowerCase() === 'salir') {
      console.log(c.gris('\nHasta luego.\n'));
      return;
    }

    const opcion = OPCIONES[eleccion] ?? Object.values(OPCIONES).find((o) => o.alias === eleccion);

    if (!opcion) {
      error(`Opcion no reconocida: "${eleccion}"`);
      continue;
    }

    try {
      await opcion.accion();
    } catch (fallo) {
      console.error(`\n${c.rojo('Fallo:')} ${fallo.message}\n`);
    }
  }
}

// --- Entrada --------------------------------------------------------------

const directa = process.argv[2];

try {
  if (directa) {
    const opcion = OPCIONES[directa] ?? Object.values(OPCIONES).find((o) => o.alias === directa);
    if (!opcion) {
      console.error(
        `${c.rojo('Opcion no reconocida:')} ${directa}\n` +
        `Validas: ${Object.values(OPCIONES).map((o) => o.alias).join(', ')}\n` +
        'Sin argumentos abre el menu.'
      );
      process.exitCode = 1;
    } else {
      await opcion.accion();
    }
  } else if (!process.stdin.isTTY) {
    console.error(
      `${c.rojo('El menu necesita una terminal interactiva.')}\n` +
      `Usa la opcion directa: node scripts/oppy.mjs preparar|backend|frontend`
    );
    process.exitCode = 1;
  } else {
    await menu();
  }
} catch (fallo) {
  console.error(`\n${c.rojo('Fallo:')} ${fallo.message}\n`);
  process.exitCode = 1;
}
