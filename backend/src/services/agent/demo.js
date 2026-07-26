/**
 * Modo demo: convocatorias de ejemplo sin scraping externo.
 *
 * Existe por una razon concreta: sin claves de Exa/Firecrawl el pipeline
 * descubre cero paginas y produce cero matches — indistinguible de estar
 * roto cuando lo que se quiere es revisar el diseno.
 *
 * Con DEMO_MODE=true se reemplaza el descubrimiento + normalizacion por este
 * catalogo. El scoring sigue yendo al agente Modal via `evaluarSeguro`.
 *
 * Todo lo demas es el camino real: el indice compartido, la deduplicacion por
 * hash, el semaforo de confianza, la persistencia de matches y la narracion en
 * vivo. Asi lo que se ve en pantalla tiene la forma exacta de lo que va a
 * llegar cuando el agente este conectado.
 *
 * NO es para produccion: `render.yaml` no define la variable, asi que un
 * despliegue nunca cae en este camino por accidente.
 */
import { clasificar } from '../scoring/trust.js';
import { calcularHash } from './normalizer.js';

/**
 * Catalogo de ejemplo.
 *
 * Elegido para cubrir los estados que el diseno tiene que resolver, no para
 * llenar la lista: las siete categorias, plazos urgentes y holgados, fuentes
 * oficiales y comunitarias (que es lo que mueve el semaforo de confianza), y
 * una patrocinada — que se marca en la interfaz y no altera su puntaje.
 *
 * `enDias` es relativo a hoy a proposito: un catalogo con fechas fijas se
 * vence solo y termina mostrando todo en gris.
 */
const CATALOGO = [
  {
    titulo: 'Beca MEXT 2027 — Gobierno de Japon',
    categoria: 'beca',
    descripcion:
      'Beca completa de posgrado en universidades japonesas: matricula, pasajes, ' +
      'estipendio mensual y curso preparatorio de idioma. Cubre maestria y doctorado ' +
      'en cualquier area, con prioridad en ingenieria y ciencias.',
    elegibilidad:
      'Boliviano menor de 35 anos, licenciatura concluida o en ultimo ano, promedio ' +
      'minimo 70/100. Ingles B2 o japones N3.',
    montoBeneficio: 'Matricula completa + 143.000 JPY mensuales + pasajes',
    skills: ['ingles b2', 'licenciatura concluida', 'promedio 70', 'carrera stem'],
    fuente: {
      nombre: 'Embajada de Japon en Bolivia',
      url: 'https://www.bo.emb-japan.go.jp/itpr_es/becas.html'
    },
    enDias: 12,
    scoreBase: 92,
    razones: [
      'Pide ultimo ano o licenciatura concluida, y estas en ese tramo',
      'Tu nivel de ingles cumple el minimo B2 que exige la convocatoria',
      'Prioriza ingenieria y ciencias, que es tu area'
    ],
    brechas: ['Certificado de promedio 70/100']
  },
  {
    titulo: 'Programa de intercambio academico Fulbright — semestre 2027',
    categoria: 'intercambio',
    descripcion:
      'Un semestre en una universidad de Estados Unidos con acompanamiento academico ' +
      'y cultural. Incluye seguro medico y estipendio de manutencion.',
    elegibilidad:
      'Estudiante regular de universidad boliviana con al menos 60% de la carrera ' +
      'aprobada. TOEFL 80 o equivalente.',
    montoBeneficio: 'Semestre completo + seguro + USD 1.200 mensuales',
    skills: ['ingles avanzado', 'toefl 80', '60% de la carrera'],
    fuente: {
      nombre: 'Embajada de Estados Unidos en Bolivia',
      url: 'https://bo.usembassy.gov/es/education-culture-es/'
    },
    enDias: 34,
    scoreBase: 78,
    razones: [
      'Estas en el tramo de carrera que pide: al menos 60% aprobado',
      'Acepta a estudiantes de cualquier universidad boliviana'
    ],
    brechas: ['TOEFL 80 o equivalente']
  },
  {
    titulo: 'Pasantia en desarrollo de software — Banco Nacional de Bolivia',
    categoria: 'pasantia',
    descripcion:
      'Seis meses en el equipo de banca digital, con mentoria asignada y posibilidad ' +
      'de contratacion al cierre. Modalidad hibrida en Santa Cruz.',
    elegibilidad:
      'Estudiante de 4to ano o superior de Ingenieria de Sistemas, Informatica o afin. ' +
      'Disponibilidad de medio tiempo.',
    montoBeneficio: 'Bs 2.500 mensuales + posibilidad de contratacion',
    skills: ['javascript', 'sql', 'git', '4to ano', 'medio tiempo'],
    fuente: {
      nombre: 'Computrabajo Bolivia',
      url: 'https://www.computrabajo.com.bo/trabajo-de-pasantias'
    },
    enDias: 6,
    scoreBase: 88,
    razones: [
      'Pide exactamente el ano de carrera en el que estas',
      'Es en tu ciudad, asi que no tenes que resolver mudanza',
      'Es de medio tiempo y se puede combinar con clases'
    ],
    brechas: []
  },
  {
    titulo: 'Analista de datos junior — Fundacion para el Desarrollo Productivo',
    categoria: 'empleo',
    descripcion:
      'Primer empleo formal en un equipo de evaluacion de programas sociales. ' +
      'Trabajo con encuestas, tableros y reportes de impacto.',
    elegibilidad:
      'Egresado o proximo a egresar de Economia, Estadistica, Sistemas o afin. ' +
      'No se exige experiencia previa.',
    montoBeneficio: 'Bs 6.000 mensuales + seguro',
    skills: ['excel avanzado', 'sql', 'power bi', 'estadistica'],
    fuente: {
      nombre: 'Busqueda semantica — pasantias y empleo joven',
      url: 'https://empleos.fundempresa.org.bo/analista-datos-junior'
    },
    enDias: 19,
    scoreBase: 71,
    razones: [
      'No exige experiencia previa, que es el filtro que suele dejar afuera al primer empleo',
      'Tu formacion cubre el analisis cuantitativo que piden'
    ],
    brechas: ['Manejo de Power BI']
  },
  {
    titulo: 'Concurso Nacional de Innovacion Universitaria 2027',
    categoria: 'concurso',
    descripcion:
      'Equipos universitarios presentan soluciones tecnologicas a problemas locales. ' +
      'Los tres primeros reciben capital semilla y acompanamiento tecnico.',
    elegibilidad:
      'Equipos de 2 a 5 estudiantes de cualquier universidad boliviana. Se permite ' +
      'participar con un proyecto en curso.',
    montoBeneficio: 'USD 10.000 en capital semilla + incubacion',
    skills: ['trabajo en equipo', 'prototipado', 'presentacion oral'],
    fuente: {
      nombre: 'Universidad Privada Boliviana',
      url: 'https://www.upb.edu/es/becas'
    },
    enDias: 41,
    scoreBase: 64,
    razones: [
      'Acepta proyectos ya empezados, no hace falta arrancar de cero',
      'No pide promedio minimo ni ano de carrera'
    ],
    brechas: ['Equipo de 2 a 5 personas']
  },
  {
    titulo: 'Fondo Emprende Joven — capital semilla para primeras empresas',
    categoria: 'financiamiento',
    descripcion:
      'Financiamiento no reembolsable para emprendimientos con menos de dos anos de ' +
      'operacion. Incluye seis meses de mentoria en modelo de negocio.',
    elegibilidad:
      'Bolivianos entre 18 y 30 anos con una idea validada o empresa recien formada. ' +
      'No se requiere garantia ni aval.',
    montoBeneficio: 'Hasta Bs 70.000 no reembolsables',
    skills: ['modelo de negocio', 'plan financiero', 'pitch'],
    fuente: {
      nombre: 'Busqueda semantica — financiamiento y concursos',
      url: 'https://emprendejoven.org.bo/convocatoria'
    },
    enDias: 27,
    scoreBase: 58,
    sponsored: true,
    razones: [
      'No pide garantia ni aval, que es lo que suele bloquear el acceso al financiamiento',
      'Estas dentro del rango de edad que pide'
    ],
    brechas: ['Plan financiero', 'Idea validada o empresa formada']
  },
  {
    titulo: 'Curso gratuito de fundamentos de inteligencia artificial',
    categoria: 'curso',
    descripcion:
      'Ocho semanas en linea, con certificado. Cubre fundamentos de aprendizaje ' +
      'automatico y uso responsable de modelos, con ejercicios practicos.',
    elegibilidad:
      'Abierto a cualquier persona con conocimientos basicos de programacion. ' +
      'Sin costo y sin cupo limitado.',
    montoBeneficio: 'Gratuito, con certificado verificable',
    skills: ['python basico', 'algebra lineal', 'ingles lectura'],
    fuente: {
      nombre: 'Fundacion Konrad Adenauer Bolivia',
      url: 'https://www.kas.de/es/web/bolivien/formacion-ia'
    },
    enDias: 58,
    scoreBase: 69,
    razones: [
      'No tiene cupo ni costo, asi que no competis por un lugar',
      'La base de programacion que pide ya la traes de la carrera'
    ],
    brechas: ['Ingles a nivel lectura']
  },
  {
    titulo: 'Beca de reinsercion laboral — formacion tecnica certificada',
    categoria: 'beca',
    descripcion:
      'Formacion tecnica de cuatro meses con horario flexible, pensada para quienes ' +
      'estuvieron fuera del mercado laboral. Incluye bolsa de trabajo al finalizar.',
    elegibilidad:
      'Personas mayores de 24 anos con al menos un ano fuera del mercado laboral. ' +
      'No se exige titulo universitario.',
    montoBeneficio: 'Formacion completa + bolsa de trabajo',
    skills: ['atencion al cliente', 'ofimatica', 'horario flexible'],
    fuente: {
      nombre: 'Busqueda semantica — becas Bolivia',
      url: 'https://reinsercion.trabajo.org.bo/convocatoria-2027'
    },
    enDias: 15,
    scoreBase: 47,
    razones: [
      'No exige titulo universitario',
      'El horario flexible es compatible con otras responsabilidades'
    ],
    brechas: ['Al menos un ano fuera del mercado laboral', 'Tener mas de 24 anos']
  }
];

function enDias(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Devuelve el catalogo con la forma exacta que produce el normalizador, para
 * que el resto del pipeline no sepa que esta en modo demo.
 */
export function oportunidadesDemo() {
  return CATALOGO.map((base) => {
    const fechaLimite = base.enDias == null ? null : enDias(base.enDias);

    return {
      titulo: base.titulo,
      categoria: base.categoria,
      descripcion: base.descripcion,
      elegibilidad: base.elegibilidad,
      montoBeneficio: base.montoBeneficio,
      skills: base.skills,
      fuente: base.fuente,
      linkAplicacion: base.fuente.url,
      fechaLimite,
      // Misma regla que en el camino real: la confianza sale del dominio y del
      // plazo, no de una etiqueta escrita a mano en el catalogo.
      confianza: clasificar({ url: base.fuente.url, fechaLimite }),
      origen: 'descubierta',
      sponsored: base.sponsored ?? false,
      hashDedupe: calcularHash(base.titulo, base.fuente.url)
    };
  });
}

const POR_TITULO = new Map(CATALOGO.map((base) => [base.titulo, base]));

/**
 * Evaluacion deterministica, en lugar del LLM.
 *
 * Parte del puntaje escrito en el catalogo y lo ajusta con la afinidad real
 * entre el perfil y la convocatoria. El ajuste importa: sin el, dos perfiles
 * distintos verian exactamente la misma lista y la pantalla de resultados no
 * probaria nada.
 *
 * Misma firma y misma forma de retorno que `evaluarSeguro`, asi que el
 * pipeline las intercambia sin saber cual esta usando.
 */
export async function evaluarDemo(perfil, oportunidad) {
  const base = POR_TITULO.get(oportunidad.titulo);
  const afinidad = calcularAfinidad(perfil, oportunidad);

  const compatibilidad = Math.max(0, Math.min(100, (base?.scoreBase ?? 60) + afinidad));

  return {
    compatibilidad,
    elegible: compatibilidad >= 50,
    razones: base?.razones ?? ['Coincide con el area y el nivel de estudios que declaraste'],
    brechas: base?.brechas ?? []
  };
}

/** Ajuste de -12 a +8 segun cuanto se toquen el perfil y la convocatoria. */
function calcularAfinidad(perfil, oportunidad) {
  const texto = [
    oportunidad.titulo,
    oportunidad.descripcion,
    oportunidad.elegibilidad,
    ...(oportunidad.skills ?? [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const terminos = [
    ...(perfil.intereses ?? []),
    ...String(perfil.carrera ?? '').split(/\s+/)
  ]
    .map((termino) => termino.trim().toLowerCase())
    .filter((termino) => termino.length > 3);

  if (terminos.length === 0) return 0;

  const coincidencias = new Set(terminos.filter((termino) => texto.includes(termino))).size;
  return coincidencias === 0 ? -12 : Math.min(8, coincidencias * 4);
}
