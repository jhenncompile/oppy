import { useState } from 'react';
import { Button } from '../components/Button.jsx';

/**
 * El objetivo es la senal mas fuerte que recibe el agente: acota que buscar
 * antes de mirar cualquier otra cosa del perfil. Por eso va primero y es la
 * unica pregunta de un solo toque.
 */
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
 * "Cuidar a mi familia" esta a proposito y no es relleno: para mucha gente son
 * anios de experiencia administrativa real que ningun formulario le reconoce.
 */
const EXPERIENCIAS = [
  { valor: 'trabajo_formal', etiqueta: 'Trabajo formal' },
  { valor: 'emprendimiento', etiqueta: 'Emprendimientos' },
  { valor: 'voluntariado', etiqueta: 'Voluntariado' },
  { valor: 'experiencia_familiar', etiqueta: 'Cuidar a mi familia' },
  { valor: 'proyectos_personales', etiqueta: 'Proyectos personales' },
  { valor: 'sin_experiencia', etiqueta: 'Todavia ninguna' }
];

/**
 * Una convocatoria perfecta a 40 km de alguien sin transporte no es una
 * oportunidad. Sin estas respuestas el agente no puede saberlo.
 */
const RESTRICCIONES = [
  { valor: 'solo_manana', etiqueta: 'Solo por la maniana' },
  { valor: 'solo_tarde', etiqueta: 'Solo por la tarde' },
  { valor: 'medio_tiempo', etiqueta: 'Medio tiempo' },
  { valor: 'remoto', etiqueta: 'Necesito que sea remoto' },
  { valor: 'cerca_de_casa', etiqueta: 'Cerca de mi casa' },
  { valor: 'necesito_ingreso_ya', etiqueta: 'Necesito ingresos pronto' },
  { valor: 'requiere_accesibilidad', etiqueta: 'Necesito accesibilidad' }
];

const INICIAL = {
  nombre: '',
  carrera: '',
  nivelEstudios: '',
  ubicacion: '',
  habilidades: '',
  email: '',
  telefono: ''
};

/** Grupo de opciones que se marcan con un toque. */
function Opciones({ leyenda, ayuda, opciones, seleccion, onCambiar, unica = false }) {
  const alternar = (valor) => {
    if (unica) return onCambiar(seleccion[0] === valor ? [] : [valor]);
    return onCambiar(
      seleccion.includes(valor)
        ? seleccion.filter((v) => v !== valor)
        : [...seleccion, valor]
    );
  };

  return (
    <fieldset className="flex flex-col gap-2 text-left">
      <legend className="text-sm font-medium text-ink">{leyenda}</legend>
      {ayuda && <p className="text-xs text-ink-secondary">{ayuda}</p>}

      <div className="mt-1 flex flex-wrap gap-2">
        {opciones.map((opcion) => {
          const activa = seleccion.includes(opcion.valor);
          return (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => alternar(opcion.valor)}
              aria-pressed={activa}
              className={[
                // 44px de alto: area tactil accesible tambien en movil
                'min-h-[44px] rounded-full border px-4 py-2 text-sm transition',
                activa
                  ? 'border-line-accent bg-surface-accent font-medium text-ink-accent'
                  : 'border-line-subtle bg-surface-card text-ink-secondary hover:bg-surface-hover'
              ].join(' ')}
            >
              {opcion.etiqueta}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Campo({ nombre, etiqueta, ayuda, opcional, valor, onCambiar, ...props }) {
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={nombre} className="text-sm font-medium text-ink">
        {etiqueta}
        {opcional && <span className="ml-2 font-normal text-ink-secondary">opcional</span>}
      </label>
      <input
        id={nombre}
        name={nombre}
        value={valor}
        onChange={onCambiar}
        aria-describedby={ayuda ? `${nombre}-ayuda` : undefined}
        className="min-h-[44px] rounded-md border border-line-subtle bg-surface-card px-4 py-3 text-ink placeholder:text-ink-secondary focus:border-line-accent focus:outline-none"
        {...props}
      />
      {ayuda && (
        <p id={`${nombre}-ayuda`} className="text-xs text-ink-secondary">
          {ayuda}
        </p>
      )}
    </div>
  );
}

/**
 * Todo lo que no es imprescindible es opcional. Cada campo obligatorio de mas
 * es gente que abandona antes de ver el valor — y el valor de Oppy solo se ve
 * del otro lado del formulario.
 */
export function Onboarding({ onEnviar, enviando }) {
  const [valores, setValores] = useState(INICIAL);
  const [objetivo, setObjetivo] = useState([]);
  const [experiencia, setExperiencia] = useState([]);
  const [restricciones, setRestricciones] = useState([]);
  const [avisarme, setAvisarme] = useState(false);

  const actualizar = (nombre) => (evento) =>
    setValores((previos) => ({ ...previos, [nombre]: evento.target.value }));

  const enviar = (evento) => {
    evento.preventDefault();

    const listaDeTexto = (texto) =>
      texto.split(',').map((item) => item.trim()).filter(Boolean);

    onEnviar({
      nombre: valores.nombre.trim() || undefined,
      carrera: valores.carrera.trim(),
      nivelEstudios: valores.nivelEstudios.trim(),
      ubicacion: valores.ubicacion.trim(),
      objetivo: objetivo[0],
      experiencia,
      habilidades: listaDeTexto(valores.habilidades),
      restricciones,
      intereses: [],
      idiomas: [],
      preferencias: {},
      email: valores.email.trim() || undefined,
      telefono: valores.telefono.trim() || undefined,
      aceptaNotificaciones: avisarme
    });
  };

  const completo =
    valores.carrera.trim() && valores.nivelEstudios.trim() && valores.ubicacion.trim();

  // El opt-in no sirve de nada sin un contacto donde avisar.
  const puedeAvisar = Boolean(valores.email.trim() || valores.telefono.trim());

  return (
    <form onSubmit={enviar} className="mx-auto flex w-full max-w-xl flex-col gap-7">
      <Opciones
        leyenda="Que estas buscando?"
        opciones={OBJETIVOS}
        seleccion={objetivo}
        onCambiar={setObjetivo}
        unica
      />

      <Campo
        nombre="nombre"
        etiqueta="Como te llamas"
        opcional
        placeholder="Diego"
        valor={valores.nombre}
        onCambiar={actualizar('nombre')}
      />

      <Campo
        nombre="carrera"
        etiqueta="Que estudias o estudiaste"
        ayuda="Si no estudiaste, escribi a que te dedicas"
        placeholder="Ingenieria de Sistemas"
        required
        valor={valores.carrera}
        onCambiar={actualizar('carrera')}
      />

      <Campo
        nombre="nivelEstudios"
        etiqueta="En que punto estas"
        placeholder="4to anio de universidad"
        required
        valor={valores.nivelEstudios}
        onCambiar={actualizar('nivelEstudios')}
      />

      <Campo
        nombre="ubicacion"
        etiqueta="Donde vivis"
        ayuda="Para buscarte cosas cerca"
        placeholder="Santa Cruz, Bolivia"
        required
        valor={valores.ubicacion}
        onCambiar={actualizar('ubicacion')}
      />

      <Opciones
        leyenda="Que experiencia tenes?"
        ayuda="Marca todo lo que aplique. Todo cuenta, no solo el trabajo formal."
        opciones={EXPERIENCIAS}
        seleccion={experiencia}
        onCambiar={setExperiencia}
      />

      <Campo
        nombre="habilidades"
        etiqueta="Que sabes hacer"
        ayuda="Separalas con comas"
        opcional
        placeholder="atencion al cliente, Excel, ventas"
        valor={valores.habilidades}
        onCambiar={actualizar('habilidades')}
      />

      <Opciones
        leyenda="Algo que deba tener en cuenta?"
        ayuda="Asi no te propongo cosas que no te sirven."
        opciones={RESTRICCIONES}
        seleccion={restricciones}
        onCambiar={setRestricciones}
      />

      {/* Contacto. Va al final a proposito: pedir datos personales antes de
          mostrar valor es la forma mas rapida de perder a alguien. */}
      <div className="flex flex-col gap-4 rounded-lg border border-line-subtle bg-surface-subtle p-4">
        <div>
          <p className="text-sm font-medium text-ink">Queres que te avise?</p>
          <p className="mt-1 text-xs text-ink-secondary">
            Oppy sigue buscando aunque no entres. Si dejas un contacto, te
            escribe solo cuando encuentra algo que de verdad calza con vos.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <Campo
              nombre="email"
              etiqueta="Correo"
              type="email"
              opcional
              placeholder="vos@correo.com"
              valor={valores.email}
              onCambiar={actualizar('email')}
            />
          </div>
          <div className="flex-1">
            <Campo
              nombre="telefono"
              etiqueta="Telefono"
              type="tel"
              opcional
              placeholder="+591 71234567"
              valor={valores.telefono}
              onCambiar={actualizar('telefono')}
            />
          </div>
        </div>

        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-left">
          <input
            type="checkbox"
            checked={avisarme && puedeAvisar}
            disabled={!puedeAvisar}
            onChange={(evento) => setAvisarme(evento.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-solid)] disabled:opacity-50"
          />
          <span className="text-sm text-ink-secondary">
            Si, avisame cuando encuentres algo para mi.{' '}
            {!puedeAvisar && (
              <span className="text-ink-muted">Dejanos un correo o telefono primero.</span>
            )}
          </span>
        </label>
      </div>

      <Button type="submit" variante="primario" tamano="lg" disabled={!completo || enviando}>
        {enviando ? 'Buscando…' : 'Buscar oportunidades para mi'}
      </Button>
    </form>
  );
}
