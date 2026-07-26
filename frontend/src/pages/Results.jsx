import { useEffect, useRef } from 'react';
import { OpportunityCard } from '../components/OpportunityCard.jsx';
import { Button } from '../components/Button.jsx';
import { api } from '../api/client.js';

function EstadoVacio({ onReintentar }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
      <p className="text-lg font-medium text-ink">
        Todavia no encontre nada para este perfil.
      </p>
      <p className="text-sm text-ink-secondary">
        Puede que las fuentes no tengan convocatorias abiertas ahora mismo. Oppy
        sigue rastreando en segundo plano y te avisa cuando aparezca algo.
      </p>
      <Button variante="secundario" onClick={onReintentar}>
        Buscar de nuevo
      </Button>
    </div>
  );
}

export function Results({ matches, perfil, onGuardar, onReintentar }) {
  // Una impresion por oportunidad y por sesion.
  //
  // La lista se refresca mientras el agente sigue corriendo, asi que sin este
  // registro se contaria una impresion nueva en cada sondeo — inflando
  // justamente la metrica que despues se le reporta a una organizacion.
  const yaRegistradas = useRef(new Set());

  useEffect(() => {
    for (const match of matches) {
      const id = match.oportunidad.id;
      if (yaRegistradas.current.has(id)) continue;

      yaRegistradas.current.add(id);
      api.registrarEvento({ userId: perfil.id, opportunityId: id, tipo: 'impresion' });
    }
  }, [matches, perfil.id]);

  if (matches.length === 0) return <EstadoVacio onReintentar={onReintentar} />;

  const abrir = (match) => {
    api.registrarEvento({
      userId: perfil.id,
      opportunityId: match.oportunidad.id,
      tipo: 'clic'
    });
    window.open(match.oportunidad.linkAplicacion, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-center text-sm text-ink-secondary">
        {matches.length}{' '}
        {matches.length === 1 ? 'oportunidad encontrada' : 'oportunidades encontradas'} para vos,
        ordenadas por compatibilidad
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {matches.map((match) => (
          <OpportunityCard
            key={match.id}
            match={match}
            onGuardar={onGuardar}
            onAbrir={abrir}
          />
        ))}
      </div>
    </div>
  );
}
