/**
 * Catalogo de fuentes.
 *
 * Agregar una fuente es agregar un objeto a esta lista — no se escribe codigo
 * nuevo. Ese es el argumento concreto cuando pregunten si esto escala: el
 * cuello de botella son las llamadas al LLM, que se cachean por el indice
 * compartido, no la cobertura de fuentes.
 *
 * IMPORTANTE: `verificada` indica si el equipo ya confirmo a mano que la URL
 * responde y que la estructura es estable. Ninguna fuente deberia llegar a una
 * demo en vivo con `verificada: false`.
 */

export const ESTRATEGIAS = {
  /** Pagina concreta y conocida: se extrae contenido estructurado. */
  SCRAPE: 'scrape',
  /** No sabemos donde esta la convocatoria: se busca semanticamente. */
  BUSQUEDA: 'busqueda'
};

export const sources = [
  {
    id: 'embajada-japon-bo',
    nombre: 'Embajada de Japon en Bolivia',
    url: 'https://www.bo.emb-japan.go.jp/itpr_es/becas.html',
    estrategia: ESTRATEGIAS.SCRAPE,
    categorias: ['beca', 'intercambio'],
    oficial: true,
    activa: true,
    verificada: false
  },
  {
    id: 'embajada-eeuu-bo',
    nombre: 'Embajada de Estados Unidos en Bolivia',
    url: 'https://bo.usembassy.gov/es/education-culture-es/',
    estrategia: ESTRATEGIAS.SCRAPE,
    categorias: ['beca', 'intercambio'],
    oficial: true,
    activa: true,
    verificada: false
  },
  {
    id: 'kas-bolivia',
    nombre: 'Fundacion Konrad Adenauer Bolivia',
    url: 'https://www.kas.de/es/web/bolivien',
    estrategia: ESTRATEGIAS.SCRAPE,
    categorias: ['beca', 'concurso', 'curso'],
    oficial: true,
    activa: true,
    verificada: false
  },
  {
    id: 'upb',
    nombre: 'Universidad Privada Boliviana',
    url: 'https://www.upb.edu/es/becas',
    estrategia: ESTRATEGIAS.SCRAPE,
    categorias: ['beca', 'intercambio'],
    oficial: true,
    activa: true,
    verificada: false
  },
  {
    id: 'computrabajo-bo',
    nombre: 'Computrabajo Bolivia',
    url: 'https://www.computrabajo.com.bo/trabajo-de-pasantias',
    estrategia: ESTRATEGIAS.SCRAPE,
    categorias: ['empleo', 'pasantia'],
    oficial: false,
    activa: true,
    verificada: false
  },

  // Busquedas semanticas: cubren lo que ninguna lista fija alcanza.
  {
    id: 'busqueda-becas-bo',
    nombre: 'Busqueda semantica — becas Bolivia',
    estrategia: ESTRATEGIAS.BUSQUEDA,
    categorias: ['beca', 'intercambio'],
    oficial: false,
    activa: true,
    verificada: true,
    dominiosPreferidos: ['gob.bo', 'edu.bo', 'org.bo']
  },
  {
    id: 'busqueda-pasantias-bo',
    nombre: 'Busqueda semantica — pasantias y empleo joven',
    estrategia: ESTRATEGIAS.BUSQUEDA,
    categorias: ['pasantia', 'empleo'],
    oficial: false,
    activa: true,
    verificada: true
  },
  {
    id: 'busqueda-financiamiento-bo',
    nombre: 'Busqueda semantica — financiamiento y concursos',
    estrategia: ESTRATEGIAS.BUSQUEDA,
    categorias: ['financiamiento', 'concurso'],
    oficial: false,
    activa: true,
    verificada: true
  }
];

/**
 * Dominios cuya publicacion se considera oficial. Es la lista blanca que
 * alimenta el semaforo de confianza: estar aca es lo unico que otorga el
 * estado 'verificada'. No se compra.
 */
export const DOMINIOS_OFICIALES = [
  'emb-japan.go.jp',
  'usembassy.gov',
  'kas.de',
  'upb.edu',
  'uagrm.edu.bo',
  'ucb.edu.bo',
  'umsa.bo',
  'agci.cl',
  'cancilleria.gob.bo',
  'minedu.gob.bo'
];

export function fuentesActivas({ categorias = null } = {}) {
  return sources.filter((fuente) => {
    if (!fuente.activa) return false;
    if (!categorias) return true;
    return fuente.categorias.some((categoria) => categorias.includes(categoria));
  });
}

export function fuentesPorEstrategia(estrategia, opciones) {
  return fuentesActivas(opciones).filter((fuente) => fuente.estrategia === estrategia);
}
