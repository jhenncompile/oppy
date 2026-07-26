import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Panel, PanelTitulo } from '../components/Panel.jsx';
import { Button } from '../components/Button.jsx';
import { usePerfil } from '../hooks/usePerfil.jsx';
import { api } from '../api/client.js';

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

function Dato({ etiqueta, children }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line-subtle py-3 last:border-0 sm:flex-row sm:gap-4">
      <dt className="text-sm text-ink-secondary sm:w-48 sm:shrink-0">{etiqueta}</dt>
      <dd className="text-sm text-ink">{children}</dd>
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
          {perfil.nombre ? `Hola, ${perfil.nombre}` : 'Esto es lo que se de vos'}
        </PanelTitulo>
      </div>

      <dl className="mx-auto max-w-2xl">
        <Dato etiqueta="Buscas">
          <Etiquetas
            valores={(perfil.objetivos ?? []).map((o) => OBJETIVOS[o] ?? o)}
            vacio="Sin definir"
          />
        </Dato>
        <Dato etiqueta="Te dedicas a">{perfil.carrera}</Dato>
        <Dato etiqueta="Estudios">{perfil.nivelEstudios}</Dato>
        <Dato etiqueta="Donde vivis">{perfil.ubicacion}</Dato>
        <Dato etiqueta="Experiencia">
          <Etiquetas valores={perfil.experiencia} vacio="No cargaste ninguna" />
        </Dato>
        <Dato etiqueta="Habilidades">
          <Etiquetas valores={perfil.habilidades} vacio="No cargaste ninguna" />
        </Dato>
        <Dato etiqueta="A tener en cuenta">
          <Etiquetas valores={perfil.restricciones} vacio="Nada en particular" />
        </Dato>
        <Dato etiqueta="Te aviso a">
          {perfil.aceptaNotificaciones
            ? perfil.email || perfil.telefono
            : 'No pediste que te avise'}
        </Dato>
      </dl>

      {/* Opt-in del matching inverso. Apagado por defecto y revocable: el
          consentimiento queda registrado con su fecha del lado del servidor. */}
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
            Si lo activas, las organizaciones que publican en Oppy pueden verte y
            proponerte oportunidades. Podes apagarlo cuando quieras.
          </span>
        </label>
      </div>

      <div className="mx-auto mt-10 flex max-w-2xl flex-wrap justify-between gap-3">
        <Button variante="primario" onClick={() => navegar('/buscando')}>
          Volver a buscar
        </Button>
        <Button
          variante="secundario"
          onClick={() => {
            olvidar();
            navegar('/', { replace: true });
          }}
        >
          Empezar de cero
        </Button>
      </div>
    </Panel>
  );
}
