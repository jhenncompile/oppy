import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Panel, PanelTitulo } from '../components/Panel.jsx';
import { Button } from '../components/Button.jsx';
import { Campo } from '../components/Campos.jsx';
import { usePerfil } from '../hooks/usePerfil.jsx';
import { useAcceso } from '../hooks/useAcceso.jsx';
import { api } from '../api/client.js';
import { Icono } from '../components/Icono.jsx';

const OBJETIVOS = {
  empleo: 'Encontrar empleo',
  reinsercion: 'Volver a trabajar',
  beca: 'Becas',
  curso: 'Cursos y certificaciones',
  crecimiento: 'Crecer profesionalmente',
  voluntariado: 'Voluntariados',
  evento: 'Eventos y hackathons'
};

const legible = (slug) => slug.replace(/_/g, ' ');

function Dato({ etiqueta, icono, children }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line-subtle py-3 last:border-0 sm:flex-row sm:gap-4">
      <dt className="flex items-center gap-2 text-sm text-ink-secondary sm:w-48 sm:shrink-0">
        <Icono nombre={icono} tamanio={15} />
        {etiqueta}
      </dt>
      <dd className="break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

function Etiquetas({ valores, vacio }) {
  if (!valores?.length) return <span className="text-ink-secondary">{vacio}</span>;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {valores.map((valor) => (
        <li key={valor} className="pill bg-surface-subtle capitalize text-ink-secondary">
          {legible(valor)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Portabilidad del perfil. Contrato en docs/12-auth.md.
 *
 * Aparece recien aca y nunca antes: la persona usa Oppy primero y despues
 * decide si quiere poder volver. Bloquear el onboarding con esto seria
 * exactamente el error que el producto evita.
 *
 * No hay un boton "activar": el codigo se manda al contacto que ya esta en el
 * perfil, asi que el acceso existe desde que ese contacto existe. Lo que se
 * ofrece es dejar el contacto, que es el paso que de verdad falta.
 *
 * Solo se muestra cuando el backend de acceso responde — mientras `disponible`
 * sea false, este bloque no existe para nadie.
 */
function Acceso({ perfil, onGuardado }) {
  const { disponible } = useAcceso();

  const [editando, setEditando] = useState(false);
  const [email, setEmail] = useState(perfil.email ?? '');
  const [telefono, setTelefono] = useState(perfil.telefono ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  if (!disponible) return null;

  // Sin consentimiento el canal no esta habilitado ni para avisos ni para
  // acceso: es la misma regla, no dos permisos distintos.
  const contacto = perfil.aceptaNotificaciones ? perfil.email || perfil.telefono : null;
  const hayAlgo = Boolean(email.trim() || telefono.trim());

  const guardarContacto = async () => {
    setGuardando(true);
    setError(null);
    try {
      const { perfil: actualizado } = await api.actualizarContacto(perfil.id, {
        email: email.trim() || null,
        telefono: telefono.trim() || null,
        aceptaNotificaciones: true
      });
      onGuardado(actualizado);
      setEditando(false);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-lg border border-line-subtle p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <Icono nombre="escudo" tamanio={16} className="text-ink-accent" />
        Volver a entrar
      </p>

      {!editando && contacto && (
        <>
          <p className="mt-2 text-sm text-ink-secondary">
            Si limpias el navegador, cambias de telefono o entras desde otra
            computadora, puedes recuperar tu perfil con un codigo que te mando a{' '}
            <strong className="break-all font-medium text-ink">{contacto}</strong>. No hace
            falta clave.
          </p>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink-secondary underline underline-offset-2 hover:text-ink"
          >
            <Icono nombre="correo" tamanio={15} />
            Cambiar mi contacto
          </button>
        </>
      )}

      {!editando && !contacto && (
        <>
          <p className="mt-2 flex items-start gap-2 text-sm text-ink-secondary">
            <Icono nombre="alerta" tamanio={16} className="mt-0.5 text-trust-pending-text" />
            <span>
              Tu perfil vive solo en este navegador. Si lo limpias o cambias de
              dispositivo, se pierde.
            </span>
          </p>
          <div className="mt-3">
            <Button variante="secundario" onClick={() => setEditando(true)}>
              <Icono nombre="escudo" tamanio={15} />
              Guardar mi acceso
            </Button>
          </div>
        </>
      )}

      {editando && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-ink-secondary">
            Dejame un correo o un telefono. Te mando ahi un codigo cuando quieras
            volver a entrar — y nada mas que eso, salvo que encuentre algo que
            te sirva.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Campo
                nombre="acceso-email"
                etiqueta="Correo"
                type="email"
                opcional
                placeholder="tucorreo@ejemplo.com"
                valor={email}
                onCambiar={(evento) => setEmail(evento.target.value)}
              />
            </div>
            <div className="flex-1">
              <Campo
                nombre="acceso-telefono"
                etiqueta="Telefono"
                type="tel"
                opcional
                placeholder="+591 71234567"
                valor={telefono}
                onCambiar={(evento) => setTelefono(evento.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="flex items-start gap-2 text-sm text-trust-stale-text" role="alert">
              <Icono nombre="alerta" tamanio={16} className="mt-0.5" />
              <span>{error}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variante="primario"
              onClick={guardarContacto}
              disabled={!hayAlgo || guardando}
            >
              <Icono nombre="check" tamanio={15} />
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                setEmail(perfil.email ?? '');
                setTelefono(perfil.telefono ?? '');
                setError(null);
              }}
              className="min-h-[44px] text-sm text-ink-secondary underline underline-offset-2 hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Perfil() {
  const { perfil, guardar, olvidar } = usePerfil();
  const navegar = useNavigate();
  const [guardandoVisibilidad, setGuardandoVisibilidad] = useState(false);

  if (!perfil) return <Navigate to="/" replace />;

  const cambiarVisibilidad = async (visible) => {
    setGuardandoVisibilidad(true);
    try {
      const { perfil: actualizado } = await api.actualizarVisibilidad(perfil.id, visible);
      guardar(actualizado);
    } catch {
      // El toggle vuelve solo a su lugar porque el estado sale del perfil.
    } finally {
      setGuardandoVisibilidad(false);
    }
  };

  return (
    <Panel>
      <div className="mb-8">
        <PanelTitulo sobretitulo="Tu perfil">
          {perfil.nombre ? `Hola, ${perfil.nombre}` : 'Esto es lo que se de ti'}
        </PanelTitulo>
      </div>

      <dl className="mx-auto max-w-2xl">
        <Dato etiqueta="Buscas" icono="objetivo">
          <Etiquetas
            valores={(perfil.objetivos ?? []).map((o) => OBJETIVOS[o] ?? o)}
            vacio="Sin definir"
          />
        </Dato>
        <Dato etiqueta="Te dedicas a" icono="maletin">{perfil.carrera}</Dato>
        <Dato etiqueta="Estudios" icono="birrete">{perfil.nivelEstudios}</Dato>
        <Dato etiqueta="Donde vives" icono="ubicacion">{perfil.ubicacion}</Dato>
        <Dato etiqueta="Experiencia" icono="libro">
          <Etiquetas valores={perfil.experiencia} vacio="No cargaste ninguna" />
        </Dato>
        <Dato etiqueta="Habilidades" icono="chispas">
          <Etiquetas valores={perfil.habilidades} vacio="No cargaste ninguna" />
        </Dato>
        <Dato etiqueta="A tener en cuenta" icono="info">
          <Etiquetas valores={perfil.restricciones} vacio="Nada en particular" />
        </Dato>
        <Dato etiqueta="Te aviso a" icono="campana">
          {perfil.aceptaNotificaciones
            ? perfil.email || perfil.telefono
            : 'No pediste que te avise'}
        </Dato>
      </dl>

      <Acceso perfil={perfil} onGuardado={guardar} />

      {/* Opt-in del matching inverso. Apagado por defecto y revocable: el
          consentimiento queda registrado con su fecha del lado del servidor.

          El texto aclara que todavia no hay organizaciones publicando porque
          es verdad: hoy nada consume el listado de perfiles visibles. Pedir un
          permiso en presente para un uso que todavia no ocurre es lo que hace
          que despues no se crea ninguno de los otros permisos. */}
      <div className="mx-auto mt-10 max-w-2xl rounded-lg border border-line-subtle p-4">
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={perfil.visibleParaEmpresas}
            disabled={guardandoVisibilidad}
            onChange={(evento) => cambiarVisibilidad(evento.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-solid)]"
          />
          <span className="text-sm text-ink-secondary">
            <strong className="font-medium text-ink">
              Dejar que las organizaciones me encuentren
            </strong>
            <br />
            Todavia ninguna organizacion publica en Oppy. Si lo activas ahora,
            vas a aparecer para las que empiecen a hacerlo y podran proponerte
            oportunidades. Puedes apagarlo cuando quieras.
          </span>
        </label>
      </div>

      <div className="mx-auto mt-10 flex max-w-2xl flex-wrap justify-between gap-3">
        <Button variante="primario" onClick={() => navegar('/buscando')}>
          <Icono nombre="refrescar" tamanio={16} />
          Volver a buscar
        </Button>
        <Button
          variante="secundario"
          onClick={() => {
            olvidar();
            navegar('/', { replace: true });
          }}
        >
          <Icono nombre="equis" tamanio={16} />
          Empezar de cero
        </Button>
      </div>
    </Panel>
  );
}
