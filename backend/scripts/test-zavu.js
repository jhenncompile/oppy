#!/usr/bin/env node
/**
 * Prueba manual de Zavu, aislada del resto del sistema.
 *
 * Sirve para dos cosas: confirmar que la clave funciona antes de conectar el
 * envio al pipeline, y tener a mano una forma de disparar un mensaje real en
 * vivo si durante el pitch hace falta demostrar el canal.
 *
 *   node scripts/test-zavu.js tu@correo.com
 *   node scripts/test-zavu.js +59171234567
 *
 * Se corre desde `backend/`: el .env se lee del directorio actual.
 */
import { env } from '../src/config/env.js';
import { enviarNotificacion } from '../src/services/notifications/zavu.js';
import { mensajeDeOportunidad } from '../src/services/notifications/templates.js';

const destinatario = process.argv[2];

if (!destinatario) {
  console.error('Falta el destinatario.\n\n  node scripts/test-zavu.js tu@correo.com\n');
  process.exit(1);
}

if (!env.features.zavu) {
  console.error('ZAVUDEV_API_KEY esta vacia en backend/.env.\n');
  process.exit(1);
}

// Match de mentira, con la forma exacta que produce el pipeline: asi lo que se
// prueba es el texto real y no un "hola mundo" que no dice nada.
const match = {
  compatibilidad: 92,
  razones: ['Pide 4to anio o superior, y estas en ese tramo'],
  oportunidad: {
    titulo: 'Beca MEXT 2027 — Gobierno de Japon',
    fechaLimite: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
    linkAplicacion: 'https://www.bo.emb-japan.go.jp/itpr_es/becas.html'
  }
};

const texto = mensajeDeOportunidad({ perfil: { nombre: 'Diego' }, match });

console.log(`\nDestinatario: ${destinatario}`);
console.log('─'.repeat(60));
console.log(texto);
console.log('─'.repeat(60));

const resultado = await enviarNotificacion(destinatario, texto);

console.log('\nResultado:', JSON.stringify(resultado, null, 2), '\n');
process.exitCode = resultado.exito ? 0 : 1;
