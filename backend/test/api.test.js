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

/**
 * Regresion: un id mal formado en la ruta llegaba hasta Postgres, que lo
 * rechazaba con "invalid input syntax for type uuid" y salia como 500 — o sea,
 * un pedido mal escrito se reportaba como si el servidor se hubiera caido.
 */
test('un id que no es UUID devuelve 400, no 500', async () => {
  for (const url of [
    `${base}/api/profiles/basura`,
    `${base}/api/matches/basura`
  ]) {
    const respuesta = await fetch(url, url.includes('matches')
      ? {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'guardado' })
        }
      : undefined);

    assert.equal(respuesta.status, 400, url);
    const cuerpo = await respuesta.json();
    assert.equal(cuerpo.error.code, 'bad_request');
  }
});

test('un UUID bien formado pero inexistente sigue dando 404', async () => {
  const respuesta = await fetch(`${base}/api/profiles/00000000-0000-4000-8000-000000000000`);
  assert.equal(respuesta.status, 404);
});

// ---------------------------------------------------------------------------
// Acceso por codigo. Contrato en docs/12-auth.md.
// ---------------------------------------------------------------------------

test('auth: /estado dice si el acceso se puede usar', async () => {
  const respuesta = await fetch(`${base}/api/auth/estado`);
  assert.equal(respuesta.status, 200);

  const cuerpo = await respuesta.json();
  assert.equal(typeof cuerpo.disponible, 'boolean');

  // Sin canal de envio no hay codigo posible: `disponible` no puede decir que
  // si mientras Zavu este apagado, o el frontend ofreceria algo que no termina.
  if (!cuerpo.disponible) assert.equal(cuerpo.canal, null);
});

test('auth: pedir un codigo sin contacto devuelve 400, no 500', async () => {
  const respuesta = await fetch(`${base}/api/auth/codigo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(respuesta.status, 400);
});

test('auth: canjear con un codigo que no son 6 digitos devuelve 400', async () => {
  for (const codigo of ['123', 'abcdef', '1234567', '']) {
    const respuesta = await fetch(`${base}/api/auth/sesion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacto: 'maria@correo.com', codigo })
    });
    assert.equal(respuesta.status, 400, `codigo "${codigo}" deberia dar 400`);
  }
});

test('auth: cambiar contacto de un id que no es UUID devuelve 400', async () => {
  const respuesta = await fetch(`${base}/api/profiles/no-es-uuid/contacto`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'maria@correo.com', aceptaNotificaciones: true })
  });
  assert.equal(respuesta.status, 400);
});

test('auth: aceptar avisos sin dejar contacto se rechaza', async () => {
  // Aceptar que te avisen sin decir a donde es un estado imposible: la fila
  // quedaria marcada como notificable y no habria destinatario.
  const respuesta = await fetch(
    `${base}/api/profiles/11111111-1111-4111-8111-111111111111/contacto`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aceptaNotificaciones: true })
    }
  );
  assert.equal(respuesta.status, 400);
});

test('libreta: anotar sin userId se rechaza antes de tocar la base', async () => {
  const respuesta = await fetch(`${base}/api/propias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo: 'Ayudante de cocina en el centro' })
  });
  assert.equal(respuesta.status, 400);
});

test('libreta: solo el titulo es obligatorio — falta y se rechaza', async () => {
  // El resto es opcional a proposito: lo que llega por WhatsApp no tiene
  // enlace, ni organizacion, ni fecha. Pero sin titulo no hay nada que anotar.
  const respuesta = await fetch(`${base}/api/propias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: '11111111-1111-4111-8111-111111111111', donde: 'un cartel' })
  });
  assert.equal(respuesta.status, 400);
});

test('libreta: un enlace que no es URL se rechaza', async () => {
  const respuesta = await fetch(`${base}/api/propias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: '11111111-1111-4111-8111-111111111111',
      titulo: 'Ayudante de cocina',
      enlace: 'no-es-una-url'
    })
  });
  assert.equal(respuesta.status, 400);
});

test('libreta: pedirla sin decir de quien es devuelve 400', async () => {
  const respuesta = await fetch(`${base}/api/propias`);
  assert.equal(respuesta.status, 400);
});

test('libreta: un estado que no existe en el seguimiento se rechaza', async () => {
  const respuesta = await fetch(
    `${base}/api/propias/11111111-1111-4111-8111-111111111111`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: '11111111-1111-4111-8111-111111111111',
        estado: 'inventado'
      })
    }
  );
  assert.equal(respuesta.status, 400);
});
