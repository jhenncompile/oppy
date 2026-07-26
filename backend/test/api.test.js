import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

import { crearApp } from '../src/app.js';

/**
 * Prueba de integracion sin base de datos.
 *
 * Levanta el servidor real y ejercita todo el cableado: rutas, validacion,
 * manejo de errores y streaming. Cubre a proposito los caminos que NO tocan
 * Postgres, que son justamente donde viven los errores de configuracion que
 * de otro modo solo aparecen en vivo.
 */
let servidor;
let base;

before(async () => {
  servidor = crearApp().listen(0);
  await new Promise((resolve) => servidor.once('listening', resolve));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor?.close());

test('health responde y expone que capacidades estan activas', async () => {
  const respuesta = await fetch(`${base}/health`);
  assert.equal(respuesta.status, 200);

  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.estado, 'ok');
  assert.equal(typeof cuerpo.capacidades.exa, 'boolean');
  assert.equal(typeof cuerpo.capacidades.firecrawl, 'boolean');
  assert.equal(typeof cuerpo.capacidades.oppy, 'boolean');
});

test('una ruta inexistente devuelve 404 con forma de error consistente', async () => {
  const respuesta = await fetch(`${base}/api/no-existe`);
  assert.equal(respuesta.status, 404);

  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.error.code, 'not_found');
});

test('crear perfil sin campos obligatorios devuelve 400, no 500', async () => {
  const respuesta = await fetch(`${base}/api/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ carrera: 'x' })
  });

  assert.equal(respuesta.status, 400);
  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.error.code, 'bad_request');
  assert.ok(cuerpo.error.details.fieldErrors.nivelEstudios);
});

test('disparar el agente con un userId que no es uuid devuelve 400', async () => {
  const respuesta = await fetch(`${base}/api/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'no-soy-un-uuid' })
  });

  assert.equal(respuesta.status, 400);
});

test('pedir matches sin userId devuelve 400', async () => {
  const respuesta = await fetch(`${base}/api/matches`);
  assert.equal(respuesta.status, 400);
});

test('registrar un evento con tipo invalido devuelve 400', async () => {
  const respuesta = await fetch(`${base}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      opportunityId: '00000000-0000-4000-8000-000000000000',
      tipo: 'inventado'
    })
  });

  assert.equal(respuesta.status, 400);
});

/**
 * Regresion: el stream de una corrida inexistente debe cerrar limpio.
 * Antes cerraba con ReferenceError porque el temporizador de latido se
 * limpiaba antes de existir.
 */
test('el stream de una corrida inexistente responde 404 sin colgarse', async () => {
  const respuesta = await fetch(
    `${base}/api/agent/runs/00000000-0000-4000-8000-000000000000/stream`
  );

  assert.equal(respuesta.status, 404);
  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.error.code, 'not_found');
});

/** El stream de una corrida viva debe emitir los pasos ya ocurridos. */
test('el stream reenvia los pasos anteriores a quien se conecta tarde', async () => {
  const runTracker = await import('../src/services/agent/runTracker.js');
  const runId = '11111111-1111-4111-8111-111111111111';

  runTracker.crear(runId);
  runTracker.emitir(runId, { tipo: 'perfil', mensaje: 'paso previo' });

  const respuesta = await fetch(`${base}/api/agent/runs/${runId}/stream`);
  assert.equal(respuesta.status, 200);
  assert.match(respuesta.headers.get('content-type'), /text\/event-stream/);

  const lector = respuesta.body.getReader();
  const { value } = await lector.read();
  const texto = new TextDecoder().decode(value);

  assert.match(texto, /event: paso/);
  assert.match(texto, /paso previo/);

  await lector.cancel();
  runTracker.finalizar(runId, { estado: 'completada' });
});

/** Una corrida ya terminada no debe dejar la conexion abierta. */
test('el stream de una corrida terminada cierra de inmediato', async () => {
  const runTracker = await import('../src/services/agent/runTracker.js');
  const runId = '22222222-2222-4222-8222-222222222222';

  runTracker.crear(runId);
  runTracker.emitir(runId, { tipo: 'perfil', mensaje: 'listo' });
  runTracker.finalizar(runId, { estado: 'completada', resumen: { matchesCreados: 3 } });

  const respuesta = await fetch(`${base}/api/agent/runs/${runId}/stream`);
  assert.equal(respuesta.status, 200);

  // Si el handler no cerrara, este texto nunca resolveria.
  const texto = await respuesta.text();
  assert.match(texto, /event: fin/);
  assert.match(texto, /completada/);
});
