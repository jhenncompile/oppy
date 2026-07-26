import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Panel, PanelTitulo } from '../components/Panel.jsx';
import { Button } from '../components/Button.jsx';
import { OpportunityCard } from '../components/OpportunityCard.jsx';
import { PropiaCard } from '../components/PropiaCard.jsx';
import { FormularioPropia } from '../components/FormularioPropia.jsx';
import { usePerfil } from '../hooks/usePerfil.jsx';
import { useMatchesCompartidos, usePropiasCompartidas } from '../Layout.jsx';
import { CIERRA_PRONTO_DIAS, enSeguimiento } from '../hooks/useMatches.js';
import { filasConFecha } from '../hooks/usePropias.js';
import { Icono } from '../components/Icono.jsx';

/**
 * El seguimiento avanza: guardada -> preparando -> aplicada -> entrevista ->
 * finalizada. Se muestra agrupado y no como tablero kanban: una lista es mas
 * simple de entender y, sobre todo, se puede usar con teclado y con lector de
 * pantalla. Arrastrar tarjetas no.
 *
 * Cada grupo tiene su icono para que la etapa se reconozca al bajar rapido por
 * la pagina, sin leer los cinco titulos.
 *
 * Conviven dos fuentes en los mismos grupos: lo que encontro el agente y lo que
 * la persona anoto por su cuenta. Mezcladas y no en dos listas separadas,
 * porque para quien esta buscando la pregunta es "en que ando", no "quien lo
 * encontro". Cada tarjeta si dice de donde vino.
 */
const GRUPOS = [
  {
    estado: 'guardado',
    titulo: 'Guardadas',
    icono: 'marcador',
    ayuda: 'Las marcaste para mirar despues.'
  },
  {
    estado: 'preparando',
    titulo: 'Preparando',
    icono: 'libro',
    ayuda: 'Estas juntando lo que piden.'
  },
  {
    estado: 'aplicada',
    titulo: 'Aplicadas',
    icono: 'enviar',
    ayuda: 'Ya enviaste tu postulacion.'
  },
  {
    estado: 'entrevista',
    titulo: 'En entrevista',
    icono: 'personas',
    ayuda: 'Te contactaron.'
  },
  {
    estado: 'finalizada',
    titulo: 'Finalizadas',
    icono: 'check-circulo',
    ayuda: 'Cerradas, con el resultado que sea.'
  }
];

const textoPlazo = (dias) =>
  dias === 0 ? 'Cierra hoy' : dias === 1 ? 'Cierra en 1 dia' : `Cierra en ${dias} dias`;

/** Lo que cierra pronto va arriba de todo: es lo unico que tiene reloj. */
function Recordatorios({ filas }) {
  const urgentes = filas.filter((fila) => fila.dias <= CIERRA_PRONTO_DIAS);

  if (urgentes.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-trust-pending-border bg-trust-pending-bg p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-trust-pending-text">
        <Icono nombre="reloj" tamanio={16} />
        {urgentes.length === 1 ? 'Una cierra pronto' : `${urgentes.length} cierran pronto`}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {urgentes.map((fila) => (
          <li key={fila.clave} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-ink">{fila.titulo}</span>

            {/* La anotada a mano no tiene detalle adentro de Oppy: no hay nada
                que Oppy pueda contar sobre ella que la persona no sepa ya. */}
            {fila.rutaDetalle ? (
              <Link
                to={fila.rutaDetalle}
                className="min-h-[44px] text-sm font-medium text-ink-accent underline underline-offset-2"
              >
                {textoPlazo(fila.dias)}
              </Link>
            ) : (
              <span className="text-sm font-medium text-trust-pending-text">
                {textoPlazo(fila.dias)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Seguimiento() {
  const { perfil } = usePerfil();
  const { matches, cambiarEstado } = useMatchesCompartidos();
  const {
    propias,
    agregar,
    cambiarEstado: cambiarEstadoPropia,
    eliminar: eliminarPropia
  } = usePropiasCompartidas();
  const [anotando, setAnotando] = useState(false);
  const navegar = useNavigate();

  if (!perfil) return <Navigate to="/" replace />;

  const seguidas = matches.filter(enSeguimiento);
  const vacio = seguidas.length === 0 && propias.length === 0;

  return (
    <Panel>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <PanelTitulo sobretitulo="Seguimiento">Mis oportunidades</PanelTitulo>

        {!anotando && !vacio && (
          <Button variante="secundario" onClick={() => setAnotando(true)}>
            <Icono nombre="marcador" tamanio={16} />
            Anotar una que encontraste
          </Button>
        )}
      </div>

      {anotando && (
        <FormularioPropia onGuardar={agregar} onCancelar={() => setAnotando(false)} />
      )}

      {vacio && !anotando ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-6 text-center">
          <Icono nombre="marcador" tamanio={40} className="text-ink-secondary" />
          <p className="text-lg font-medium text-ink">Todavia no guardaste ninguna.</p>
          <p className="text-sm text-ink-secondary">
            Cuando encuentres algo que te interese, guardalo y aca vas a poder
            seguirle el rastro hasta que se cierre. Tambien puedes anotar las que
            encuentres por tu cuenta, aunque Oppy no las haya visto nunca.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variante="primario" onClick={() => navegar('/oportunidades')}>
              <Icono nombre="brujula" tamanio={16} />
              Ver oportunidades
            </Button>
            <Button variante="secundario" onClick={() => setAnotando(true)}>
              <Icono nombre="marcador" tamanio={16} />
              Anotar una
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Recordatorios filas={filasConFecha({ matches, propias })} />

          <div className="flex flex-col gap-10">
            {GRUPOS.map((grupo) => {
              const delGrupo = seguidas.filter((m) => m.estado === grupo.estado);
              const propiasDelGrupo = propias.filter((p) => p.estado === grupo.estado);
              const total = delGrupo.length + propiasDelGrupo.length;
              if (total === 0) return null;

              return (
                <section key={grupo.estado}>
                  <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                    <Icono nombre={grupo.icono} tamanio={17} className="text-ink-accent" />
                    {grupo.titulo}{' '}
                    <span className="font-normal text-ink-secondary">({total})</span>
                  </h3>
                  <p className="mt-1 text-sm text-ink-secondary">{grupo.ayuda}</p>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {delGrupo.map((match) => (
                      <OpportunityCard
                        key={match.id}
                        match={match}
                        onGuardar={(m) => cambiarEstado(m, 'visto')}
                        onSeguimiento={cambiarEstado}
                      />
                    ))}

                    {propiasDelGrupo.map((propia) => (
                      <PropiaCard
                        key={propia.id}
                        propia={propia}
                        onCambiarEstado={cambiarEstadoPropia}
                        onEliminar={eliminarPropia}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
