import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '../components/Panel.jsx';
import { Button } from '../components/Button.jsx';
import { Campo, Opciones, Selector } from '../components/Campos.jsx';
import { usePerfil } from '../hooks/usePerfil.jsx';
import { api } from '../api/client.js';
import { Icono } from '../components/Icono.jsx';

const MAX_OBJETIVOS = 3;
const BORRADOR = 'oppy.borrador';

const OBJETIVOS = [
  { valor: 'empleo', etiqueta: 'Encontrar empleo' },
  { valor: 'reinsercion', etiqueta: 'Volver a trabajar' },
  { valor: 'beca', etiqueta: 'Becas' },
  { valor: 'curso', etiqueta: 'Cursos y certificaciones' },
  { valor: 'crecimiento', etiqueta: 'Crecer profesionalmente' },
  { valor: 'voluntariado', etiqueta: 'Voluntariados' },
  { valor: 'evento', etiqueta: 'Eventos y hackathons' }
];

/**
 * "Cuidar a mi familia" no es relleno: para mucha gente son anios de
 * experiencia administrativa real que ningun formulario le reconoce. Es la
 * razon de existir del producto, y por eso lleva nota propia.
 */
const EXPERIENCIAS = [
  { valor: 'trabajo_formal', etiqueta: 'Trabajo formal' },
  { valor: 'emprendimiento', etiqueta: 'Emprendimientos' },
  { valor: 'trabajo_informal', etiqueta: 'Trabajo por mi cuenta' },
  { valor: 'voluntariado', etiqueta: 'Voluntariado' },
  {
    valor: 'experiencia_familiar',
    etiqueta: 'Cuidar a mi familia',
    nota: 'Cuidar una casa o una familia es experiencia. Aca cuenta.'
  },
  { valor: 'proyectos_personales', etiqueta: 'Proyectos personales' },
  { valor: 'practicas', etiqueta: 'Practicas o pasantias' },
  { valor: 'sin_experiencia', etiqueta: 'Todavia ninguna' }
];

const HABILIDADES = [
  { valor: 'comunicacion', etiqueta: 'Comunicacion' },
  { valor: 'atencion_al_cliente', etiqueta: 'Atencion al cliente' },
  { valor: 'ventas', etiqueta: 'Ventas' },
  { valor: 'organizacion', etiqueta: 'Organizacion' },
  { valor: 'trabajo_en_equipo', etiqueta: 'Trabajo en equipo' },
  { valor: 'liderazgo', etiqueta: 'Liderazgo' },
  { valor: 'manejo_de_dinero', etiqueta: 'Manejo de dinero' },
  { valor: 'computacion_basica', etiqueta: 'Computacion basica' },
  { valor: 'excel', etiqueta: 'Excel' },
  { valor: 'redes_sociales', etiqueta: 'Redes sociales' },
  { valor: 'ensenanza', etiqueta: 'Dar clases' },
  { valor: 'cocina', etiqueta: 'Cocina' },
  { valor: 'costura', etiqueta: 'Costura' },
  { valor: 'construccion', etiqueta: 'Construccion' },
  { valor: 'conduccion', etiqueta: 'Manejar' }
];

/**
 * Ninguna de estas opciones se presenta como una limitacion de la persona: el
 * encabezado del paso deja claro que es informacion para buscar mejor.
 */
const RESTRICCIONES = [
  { valor: 'horario_manana', etiqueta: 'Solo antes del mediodia' },
  { valor: 'horario_tarde', etiqueta: 'Solo por la tarde' },
  { valor: 'horario_noche', etiqueta: 'Solo por la noche' },
  { valor: 'solo_fines_de_semana', etiqueta: 'Solo fines de semana' },
  { valor: 'medio_tiempo', etiqueta: 'Medio tiempo' },
  { valor: 'remoto', etiqueta: 'Necesito que sea remoto' },
  { valor: 'cuidado_familiar', etiqueta: 'Cuido a alguien' },
  { valor: 'sin_transporte', etiqueta: 'No tengo transporte' },
  { valor: 'necesidad_economica_inmediata', etiqueta: 'Necesito ingresos pronto' },
  { valor: 'sin_internet_en_casa', etiqueta: 'Sin internet en casa' },
  { valor: 'sin_computadora', etiqueta: 'Sin computadora' },
  { valor: 'discapacidad_visual', etiqueta: 'Discapacidad visual' },
  { valor: 'discapacidad_auditiva', etiqueta: 'Discapacidad auditiva' },
  { valor: 'discapacidad_motriz', etiqueta: 'Discapacidad motriz' }
];

const CIUDADES = [
  'La Paz', 'El Alto', 'Santa Cruz de la Sierra', 'Cochabamba', 'Sucre',
  'Oruro', 'Potosi', 'Tarija', 'Trinidad', 'Cobija'
];

const NIVELES = [
  'Primaria', 'Secundaria', 'Tecnico', 'Universidad en curso',
  'Universidad concluida', 'Posgrado', 'Prefiero no decir'
];

const RANGOS_EDAD = [
  { valor: '18-24', etiqueta: '18 a 24', medio: 21 },
  { valor: '25-34', etiqueta: '25 a 34', medio: 30 },
  { valor: '35-44', etiqueta: '35 a 44', medio: 40 },
  { valor: '45-54', etiqueta: '45 a 54', medio: 50 },
  { valor: '55+', etiqueta: '55 o mas', medio: 60 }
];

const INICIAL = {
  nombre: '',
  rangoEdad: [],
  ciudad: '',
  otraCiudad: '',
  objetivos: [],
  experiencia: [],
  habilidades: [],
  habilidadPropia: '',
  carrera: '',
  nivelEstudios: '',
  restricciones: [],
  email: '',
  telefono: '',
  avisarme: false
};

const etiquetaObjetivo = (valor) =>
  OBJETIVOS.find((o) => o.valor === valor)?.etiqueta ?? valor;

function Progreso({ paso, total }) {
  return (
    <div className="mb-10">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink-accent">Paso {paso} de {total}</p>
        <p className="text-xs text-ink-secondary">Puedes volver atras cuando quieras</p>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-score-track"
        role="progressbar"
        aria-valuenow={paso}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label="Progreso del formulario"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${(paso / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Pregunta({ titulo, ayuda, children }) {
  return (
    <div className="flex flex-col gap-6 text-left">
      <div>
        <h2 className="font-display text-2xl font-bold leading-snug text-ink sm:text-3xl">
          {titulo}
        </h2>
        {ayuda && <p className="mt-2 text-base text-ink-secondary">{ayuda}</p>}
      </div>
      {children}
    </div>
  );
}

function Resumen({ etiqueta, valor }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-line-subtle py-2 text-sm last:border-0">
      <span className="text-ink-secondary">{etiqueta}</span>
      <span className="text-right font-medium text-ink">{valor || '—'}</span>
    </div>
  );
}

/**
 * Onboarding en seis pasos.
 *
 * Una pregunta grande por paso, no un formulario largo: un scroll de quince
 * campos se siente tramite, y esta app la usa gente que ya siente que las
 * plataformas son complicadas. Se puede volver atras siempre, y el borrador
 * sobrevive a un refresh — perder lo escrito es la forma mas rapida de que
 * alguien no vuelva.
 */
export function Onboarding() {
  const [paso, setPaso] = useState(1);
  const [v, setV] = useState(() => {
    try {
      return { ...INICIAL, ...JSON.parse(localStorage.getItem(BORRADOR) ?? '{}') };
    } catch {
      return INICIAL;
    }
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const navegar = useNavigate();
  const { guardar } = usePerfil();

  const TOTAL = 6;

  useEffect(() => {
    localStorage.setItem(BORRADOR, JSON.stringify(v));
  }, [v]);

  // Cada paso empieza arriba: si no, el paso 4 arranca a media pantalla.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [paso]);

  const set = (campo) => (valor) => setV((previo) => ({ ...previo, [campo]: valor }));
  const setTexto = (campo) => (evento) => set(campo)(evento.target.value);

  const ubicacion = v.ciudad === 'Otra' ? v.otraCiudad.trim() : v.ciudad;

  const puedeSeguir = {
    1: Boolean(ubicacion),
    2: v.objetivos.length > 0,
    3: true,
    4: Boolean(v.carrera.trim() && v.nivelEstudios),
    5: true,
    6: true
  }[paso];

  const enviar = async () => {
    setEnviando(true);
    setError(null);

    const propias = v.habilidadPropia
      .split(',')
      .map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
      .filter(Boolean);

    try {
      const { perfil } = await api.crearPerfil({
        nombre: v.nombre.trim() || undefined,
        edad: RANGOS_EDAD.find((r) => r.valor === v.rangoEdad[0])?.medio,
        carrera: v.carrera.trim(),
        nivelEstudios: v.nivelEstudios,
        ubicacion: `${ubicacion}, Bolivia`,
        objetivos: v.objetivos,
        experiencia: v.experiencia,
        habilidades: [...new Set([...v.habilidades, ...propias])],
        restricciones: v.restricciones,
        intereses: [],
        idiomas: [{ idioma: 'espanol', nivel: 'nativo' }],
        preferencias: {},
        email: v.email.trim() || undefined,
        telefono: v.telefono.trim() || undefined,
        aceptaNotificaciones: v.avisarme && Boolean(v.email.trim() || v.telefono.trim())
      });

      localStorage.removeItem(BORRADOR);
      guardar(perfil);
      navegar('/buscando', { replace: true });
    } catch (fallo) {
      setError(fallo.message);
      setEnviando(false);
    }
  };

  const puedeAvisar = Boolean(v.email.trim() || v.telefono.trim());

  return (
    <Panel>
      <div className="mx-auto w-full max-w-xl">
        <Progreso paso={paso} total={TOTAL} />

        {paso === 1 && (
          <Pregunta titulo="Empecemos por ti" ayuda="Nada de esto es obligatorio salvo donde vives.">
            <Campo
              nombre="nombre"
              etiqueta="Como te llamas?"
              opcional
              placeholder="Diego"
              valor={v.nombre}
              onCambiar={setTexto('nombre')}
            />
            <Opciones
              leyenda="Que edad tienes?"
              ayuda="Ayuda a filtrar convocatorias con limite de edad. Puedes omitirlo."
              opciones={RANGOS_EDAD}
              seleccion={v.rangoEdad}
              onCambiar={set('rangoEdad')}
              maximo={1}
            />
            <Selector
              nombre="ciudad"
              etiqueta="Donde vives?"
              ayuda="Para buscarte cosas cerca."
              opciones={[...CIUDADES, 'Otra']}
              valor={v.ciudad}
              onCambiar={setTexto('ciudad')}
            />
            {v.ciudad === 'Otra' && (
              <Campo
                nombre="otraCiudad"
                etiqueta="Cuentame donde"
                placeholder="Villamontes"
                valor={v.otraCiudad}
                onCambiar={setTexto('otraCiudad')}
              />
            )}
          </Pregunta>
        )}

        {paso === 2 && (
          <Pregunta titulo="Que estas buscando?" ayuda="Puedes elegir hasta tres cosas.">
            <Opciones
              leyenda="Elige lo que mas te interesa"
              ayuda={
                v.objetivos.length === 0
                  ? 'Lo primero que marques queda como principal.'
                  : `Principal: ${etiquetaObjetivo(v.objetivos[0])}. Voy a priorizarlo, pero tambien busco lo demas.`
              }
              opciones={OBJETIVOS}
              seleccion={v.objetivos}
              onCambiar={set('objetivos')}
              maximo={MAX_OBJETIVOS}
              etiquetaPrincipal
            />
          </Pregunta>
        )}

        {paso === 3 && (
          <Pregunta
            titulo="Que hiciste antes?"
            ayuda="No hace falta que sea un trabajo formal. Cuentame todo lo que hiciste."
          >
            <Opciones
              leyenda="Marca todo lo que aplique"
              opciones={EXPERIENCIAS}
              seleccion={v.experiencia}
              onCambiar={set('experiencia')}
            />
            <p className="flex items-start gap-2 rounded-md bg-surface-accent p-4 text-sm text-ink-secondary">
              <Icono nombre="corazon" tamanio={16} className="mt-0.5 text-ink-accent" />
              <span>
                Cuidar una casa o una familia <strong className="text-ink">es</strong> experiencia.
                Aca cuenta igual que un trabajo formal.
              </span>
            </p>
          </Pregunta>
        )}

        {paso === 4 && (
          <Pregunta titulo="Que sabes hacer?" ayuda="Marca lo que sepas, aunque lo hayas aprendido por tu cuenta.">
            <Opciones
              leyenda="Tus habilidades"
              opciones={HABILIDADES}
              seleccion={v.habilidades}
              onCambiar={set('habilidades')}
            />
            <Campo
              nombre="habilidadPropia"
              etiqueta="Algo mas que sepas hacer?"
              ayuda="Separalas con comas."
              opcional
              placeholder="reparacion de celulares, peluqueria"
              valor={v.habilidadPropia}
              onCambiar={setTexto('habilidadPropia')}
            />
            <Campo
              nombre="carrera"
              etiqueta="A que te dedicas o que estudiaste?"
              ayuda="Si no estudiaste, escribe a que te dedicas. Vale poner 'sin estudios formales'."
              placeholder="Administracion"
              required
              valor={v.carrera}
              onCambiar={setTexto('carrera')}
            />
            <Selector
              nombre="nivelEstudios"
              etiqueta="Hasta donde llegaste?"
              opciones={NIVELES}
              valor={v.nivelEstudios}
              onCambiar={setTexto('nivelEstudios')}
            />
          </Pregunta>
        )}

        {paso === 5 && (
          <Pregunta
            titulo="Hay algo que deba tener en cuenta?"
            ayuda="Esto me ayuda a no recomendarte cosas a las que no puedes llegar."
          >
            <Opciones
              leyenda="Marca lo que corresponda"
              opciones={RESTRICCIONES}
              seleccion={v.restricciones}
              onCambiar={set('restricciones')}
            />
          </Pregunta>
        )}

        {paso === 6 && (
          <Pregunta titulo="Listo. Esto es lo que entendi" ayuda="Revisa que este bien antes de que empiece a buscar.">
            <div className="rounded-lg border border-line-subtle bg-surface-subtle p-4">
              <Resumen etiqueta="Nombre" valor={v.nombre} />
              <Resumen etiqueta="Donde vives" valor={ubicacion} />
              <Resumen etiqueta="Buscas" valor={v.objetivos.map(etiquetaObjetivo).join(', ')} />
              <Resumen etiqueta="Te dedicas a" valor={v.carrera} />
              <Resumen etiqueta="Estudios" valor={v.nivelEstudios} />
              <Resumen etiqueta="Experiencia" valor={`${v.experiencia.length} tipo(s)`} />
              <Resumen etiqueta="Habilidades" valor={`${v.habilidades.length} marcada(s)`} />
              <Resumen etiqueta="A tener en cuenta" valor={`${v.restricciones.length} cosa(s)`} />
            </div>

            <div className="flex flex-col gap-4 rounded-lg border border-line-subtle p-4">
              <div>
                <p className="flex items-center gap-2 text-base font-medium text-ink">
                  <Icono nombre="campana" tamanio={17} className="text-ink-accent" />
                  Quieres que te avise?
                </p>
                <p className="mt-1 text-sm text-ink-secondary">
                  Sigo buscando aunque no entres. Si dejas un contacto, te escribo
                  solo cuando encuentro algo que de verdad calza con tu perfil.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-1">
                  <Campo
                    nombre="email"
                    etiqueta="Correo"
                    type="email"
                    opcional
                    placeholder="tucorreo@ejemplo.com"
                    valor={v.email}
                    onCambiar={setTexto('email')}
                  />
                </div>
                <div className="flex-1">
                  <Campo
                    nombre="telefono"
                    etiqueta="Telefono"
                    type="tel"
                    opcional
                    placeholder="+591 71234567"
                    valor={v.telefono}
                    onCambiar={setTexto('telefono')}
                  />
                </div>
              </div>

              <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={v.avisarme && puedeAvisar}
                  disabled={!puedeAvisar}
                  onChange={(e) => set('avisarme')(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-solid)] disabled:opacity-50"
                />
                <span className="text-sm text-ink-secondary">
                  Si, avisame cuando encuentres algo para mi.{' '}
                  {!puedeAvisar && <span>Dejame un correo o telefono primero.</span>}
                </span>
              </label>
            </div>

            {error && (
              <p className="flex items-start gap-2 text-sm text-trust-stale-text" role="alert">
                <Icono nombre="alerta" tamanio={16} className="mt-0.5" />
                <span>{error}</span>
              </p>
            )}
          </Pregunta>
        )}

        <div className="mt-10 flex items-center justify-between gap-3">
          <Button
            variante="secundario"
            onClick={() => setPaso((p) => p - 1)}
            disabled={paso === 1 || enviando}
          >
            <Icono nombre="flecha-izquierda" tamanio={15} />
            Atras
          </Button>

          {paso < TOTAL ? (
            <Button
              variante="primario"
              tamano="lg"
              onClick={() => setPaso((p) => p + 1)}
              disabled={!puedeSeguir}
            >
              Seguir
              <Icono nombre="flecha-derecha" tamanio={17} />
            </Button>
          ) : (
            <Button variante="primario" tamano="lg" onClick={enviar} disabled={enviando}>
              <Icono nombre="lupa" tamanio={17} />
              {enviando ? 'Empezando…' : 'Buscar oportunidades para mi'}
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}
