import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { closePool } from './index.js';
import { logger } from '../utils/logger.js';
import * as userRepository from '../repositories/userRepository.js';

const log = logger.child({ module: 'seed' });

/**
 * Contacto para la demostracion en vivo, tomado del entorno.
 *
 * Se aplica a UN solo perfil — el de reinsercion, que es el que cuenta la
 * historia del producto. Ponerlo en los tres significaria hasta nueve mensajes
 * al mismo destinatario en una corrida del cron, y un aviso que llega nueve
 * veces deja de ser un acompaniante.
 *
 * Sin las variables, los perfiles quedan sin contacto y nadie recibe nada.
 */
const CONTACTO_DEMO = {
  email: env.DEMO_CONTACTO_EMAIL || undefined,
  telefono: env.DEMO_CONTACTO_TELEFONO || undefined,
  // El opt-in exige un contacto: sin uno, marcar el consentimiento no habilita
  // nada y solo ensucia la tabla de consents.
  aceptaNotificaciones: Boolean(env.DEMO_CONTACTO_EMAIL || env.DEMO_CONTACTO_TELEFONO)
};

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
    edad: 22,
    carrera: 'Ingenieria de Sistemas',
    nivelEstudios: '4to ano de universidad',
    intereses: ['inteligencia artificial', 'desarrollo de software', 'intercambio academico'],
    ubicacion: 'Santa Cruz, Bolivia',
    idiomas: [{ idioma: 'espanol', nivel: 'nativo' }, { idioma: 'ingles', nivel: 'B2' }],
    objetivos: ['beca', 'empleo', 'evento'],
    experiencia: ['proyectos_personales', 'voluntariado'],
    habilidades: ['programacion', 'trabajo_en_equipo', 'ingles'],
    preferencias: { modalidad: 'remoto' },
    restricciones: ['horario_tarde']
  },
  {
    nombre: 'Demo — Recien egresada de Economia',
    edad: 26,
    carrera: 'Economia',
    nivelEstudios: 'licenciatura concluida',
    intereses: ['politicas publicas', 'investigacion', 'emprendimiento'],
    ubicacion: 'La Paz, Bolivia',
    idiomas: [{ idioma: 'espanol', nivel: 'nativo' }, { idioma: 'ingles', nivel: 'B1' }],
    objetivos: ['empleo', 'beca'],
    experiencia: ['practicas', 'trabajo_formal'],
    habilidades: ['analisis_de_datos', 'excel', 'redaccion', 'investigacion'],
    preferencias: { modalidad: 'presencial', radio_km: 15 },
    restricciones: []
  },
  {
    nombre: 'Demo — Reinsercion laboral',
    edad: 48,
    carrera: 'Administracion',
    nivelEstudios: 'tecnico superior',
    intereses: ['trabajo flexible', 'capacitacion gratuita', 'atencion al cliente'],
    ubicacion: 'Cochabamba, Bolivia',
    idiomas: [{ idioma: 'espanol', nivel: 'nativo' }],
    // El caso que motivo el producto: veinte anios administrando una casa son
    // experiencia administrativa, y el horario y el cuidado familiar deciden
    // que es elegible y que no.
    objetivos: ['reinsercion', 'curso'],
    experiencia: ['administracion', 'atencion_al_cliente', 'experiencia_familiar'],
    habilidades: ['comunicacion', 'ventas', 'organizacion'],
    preferencias: { modalidad: 'presencial', radio_km: 10 },
    restricciones: ['horario_manana', 'cuidado_familiar'],
    ...CONTACTO_DEMO
  }
];

export async function seed() {
  const creados = [];
  for (const perfil of PERFILES) {
    const creado = await userRepository.create(perfil);

    // El consentimiento queda registrado con su fecha: revocable y auditable,
    // igual que cuando lo da una persona desde el onboarding.
    if (creado.aceptaNotificaciones) {
      await userRepository.registrarConsentimiento(creado.id, 'notificaciones', true);
    }

    creados.push(creado);
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
