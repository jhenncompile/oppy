import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Panel, PanelTitulo } from '../components/Panel.jsx';
import { Button } from '../components/Button.jsx';
import { OpportunityCard } from '../components/OpportunityCard.jsx';
import { usePerfil } from '../hooks/usePerfil.jsx';
import { useMatchesCompartidos } from '../Layout.jsx';
import { diasRestantes, CIERRA_PRONTO_DIAS, enSeguimiento } from '../hooks/useMatches.js';
import { api } from '../api/client.js';
import { Icono, iconoDeCategoria } from '../components/Icono.jsx';

const TOP = 5;

const CATEGORIAS = [
  { valor: 'todas', etiqueta: 'Todas', icono: 'filtro' },
  { valor: 'empleo', etiqueta: 'Empleo' },
  { valor: 'beca', etiqueta: 'Becas' },
  { valor: 'curso', etiqueta: 'Cursos' },
  { valor: 'pasantia', etiqueta: 'Pasantias' },
  { valor: 'voluntariado', etiqueta: 'Voluntariado' },
  { valor: 'programa_social', etiqueta: 'Programas' },
  { valor: 'concurso', etiqueta: 'Concursos' },
  { valor: 'financiamiento', etiqueta: 'Financiamiento' },
  { valor: 'evento', etiqueta: 'Eventos' },
  { valor: 'intercambio', etiqueta: 'Intercambios' }
];

function Chip({ activo, icono, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      className={[
        'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition',
        activo
          ? 'border-line-accent bg-surface-accent font-medium text-ink-accent'
          : 'border-line-subtle bg-surface-subtle text-ink-secondary hover:bg-surface-hover'
      ].join(' ')}
      {...props}
    >
      {icono && <Icono nombre={icono} tamanio={15} />}
      {children}
    </button>
  );
}

/** Mientras carga se muestra la forma de la card, nunca un spinner solo. */
function Esqueleto() {
  return (
    <div className="flex animate-pulse flex-col gap-4 rounded-xl border border-line-subtle bg-surface-subtle p-5">
      <div className="h-5 w-28 rounded-full bg-surface-hover" />
      <div className="h-5 w-3/4 rounded bg-surface-hover" />
      <div className="h-1.5 w-36 rounded-full bg-surface-hover" />
      <div className="h-20 rounded-md bg-surface-hover" />
    </div>
  );
}

function Vacio({ onBuscar }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-6 text-center">
      <Icono nombre="lupa" tamanio={40} className="text-ink-secondary" />
      <p className="text-lg font-medium text-ink">Todavia no encontre nada para tu perfil.</p>
      <p className="text-sm text-ink-secondary">
        Puede que las fuentes no tengan convocatorias abiertas ahora mismo. Sigo
        rastreando en segundo plano y te aviso cuando aparezca algo.
      </p>
      <Button variante="secundario" onClick={onBuscar}>
        <Icono nombre="refrescar" tamanio={15} />
        Buscar de nuevo
      </Button>
    </div>
  );
}

export function Oportunidades() {
  const { perfil } = usePerfil();
  const { matches, cargando, cambiarEstado } = useMatchesCompartidos();
  const navegar = useNavigate();

  const [categoria, setCategoria] = useState('todas');
  const [soloUrgentes, setSoloUrgentes] = useState(false);
  const [mostrarTodas, setMostrarTodas] = useState(false);

  // Una impresion por oportunidad y por sesion: la lista se refresca sola y sin
  // este registro se inflaria justo la metrica que despues se le reporta a una
  // organizacion.
  const registradas = useRef(new Set());

  const visibles = useMemo(() => {
    return matches.filter((match) => {
      if (categoria !== 'todas' && match.oportunidad.categoria !== categoria) return false;
      if (!soloUrgentes) return true;

      const dias = diasRestantes(match.oportunidad.fechaLimite);
      return dias !== null && dias >= 0 && dias <= CIERRA_PRONTO_DIAS;
    });
  }, [matches, categoria, soloUrgentes]);

  useEffect(() => {
    if (!perfil) return;

    for (const match of visibles) {
      const id = match.oportunidad.id;
      if (registradas.current.has(id)) continue;
      registradas.current.add(id);
      api.registrarEvento({ userId: perfil.id, opportunityId: id, tipo: 'impresion' });
    }
  }, [visibles, perfil]);

  if (!perfil) return <Navigate to="/" replace />;


  const guardar = (match) =>
    cambiarEstado(match, enSeguimiento(match) ? 'visto' : 'guardado');

  const destacadas = mostrarTodas ? visibles : visibles.slice(0, TOP);
  const restantes = visibles.length - destacadas.length;

  return (
    <Panel>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <PanelTitulo sobretitulo="Para vos">
          {cargando
            ? 'Buscando lo tuyo…'
            : matches.length === 0
              ? 'Todavia nada'
              : `Encontre ${matches.length} ${matches.length === 1 ? 'oportunidad' : 'oportunidades'}`}
        </PanelTitulo>
        <Button variante="secundario" onClick={() => navegar('/buscando')}>
          <Icono nombre="refrescar" tamanio={15} />
          Buscar de nuevo
        </Button>
      </header>

      {matches.length > 0 && (
        <div className="mb-8 flex flex-col gap-3">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {CATEGORIAS.filter(
              (c) =>
                c.valor === 'todas' ||
                matches.some((m) => m.oportunidad.categoria === c.valor)
            ).map((c) => (
              <Chip
                key={c.valor}
                activo={categoria === c.valor}
                icono={c.icono ?? iconoDeCategoria(c.valor)}
                onClick={() => setCategoria(c.valor)}
              >
                {c.etiqueta}
              </Chip>
            ))}
          </div>
          <div>
            <Chip
              activo={soloUrgentes}
              icono="reloj"
              onClick={() => setSoloUrgentes((s) => !s)}
            >
              Solo las que cierran pronto
            </Chip>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Esqueleto />
          <Esqueleto />
        </div>
      ) : visibles.length === 0 ? (
        <Vacio onBuscar={() => navegar('/buscando')} />
      ) : (
        <>
          {!mostrarTodas && visibles.length > TOP && (
            <p className="mb-4 flex items-center gap-1.5 text-sm font-medium text-ink">
              <Icono nombre="chispas" tamanio={15} className="text-ink-accent" />
              Lo mejor para vos
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {destacadas.map((match) => (
              <OpportunityCard
                key={match.id}
                match={match}
                onGuardar={guardar}
                onSeguimiento={cambiarEstado}

              />
            ))}
          </div>

          {restantes > 0 && (
            <div className="mt-6 text-center">
              <Button variante="secundario" onClick={() => setMostrarTodas(true)}>
                Ver las otras {restantes}
                <Icono nombre="flecha-abajo" tamanio={15} />
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
