import { fileURLToPath } from 'node:url';
import { closePool } from './index.js';
import { logger } from '../utils/logger.js';
import * as userRepository from '../repositories/userRepository.js';

const log = logger.child({ module: 'seed' });

/**
 * Perfiles de prueba.
 *
 * Tres perfiles distintos a proposito: probar el scoring con uno solo — el
 * propio — es la forma mas facil de convencerse de que funciona cuando no
 * funciona. El tercero cubre el caso de reinsercion laboral, que es el que
 * motivo el producto.
 */
const PERFILES = [
  {
    nombre: 'Demo — Estudiante de Sistemas',
    carrera: 'Ingenieria de Sistemas',
    nivelEstudios: '4to ano de universidad',
    intereses: ['inteligencia artificial', 'desarrollo de software', 'intercambio academico'],
    ubicacion: 'Santa Cruz, Bolivia',
    idiomas: [{ idioma: 'espanol', nivel: 'nativo' }, { idioma: 'ingles', nivel: 'B2' }]
  },
  {
    nombre: 'Demo — Recien egresada de Economia',
    carrera: 'Economia',
    nivelEstudios: 'licenciatura concluida',
    intereses: ['politicas publicas', 'investigacion', 'emprendimiento'],
    ubicacion: 'La Paz, Bolivia',
    idiomas: [{ idioma: 'espanol', nivel: 'nativo' }, { idioma: 'ingles', nivel: 'B1' }]
  },
  {
    nombre: 'Demo — Reinsercion laboral',
    carrera: 'Administracion',
    nivelEstudios: 'tecnico superior',
    intereses: ['trabajo flexible', 'capacitacion gratuita', 'atencion al cliente'],
    ubicacion: 'Cochabamba, Bolivia',
    idiomas: [{ idioma: 'espanol', nivel: 'nativo' }]
  }
];

export async function seed() {
  const creados = [];
  for (const perfil of PERFILES) {
    creados.push(await userRepository.create(perfil));
  }
  return creados;
}

const isEntryPoint = process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  try {
    const perfiles = await seed();
    for (const perfil of perfiles) {
      log.info('Perfil creado', { id: perfil.id, nombre: perfil.nombre });
    }
  } catch (error) {
    log.error('Seed fallido', { error: error.message });
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
