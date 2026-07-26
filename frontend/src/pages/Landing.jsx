import { Link, Navigate } from 'react-router-dom';
import { Panel, PanelTitulo } from '../components/Panel.jsx';
import { Button } from '../components/Button.jsx';
import { usePerfil } from '../hooks/usePerfil.jsx';
import { useAcceso } from '../hooks/useAcceso.jsx';
import { Icono } from '../components/Icono.jsx';

/**
 * Los canales que todavia no existen se muestran igual, deshabilitados.
 *
 * No es decoracion: son la promesa de accesibilidad del producto, y esconderla
 * hasta que este lista es decirle a quien la necesita que no fue pensada.
 */
const CANALES = [
  { icono: 'mensaje', texto: 'WhatsApp' },
  { icono: 'enviar', texto: 'Telegram' },
  { icono: 'microfono', texto: 'Contame hablando' }
];

export function Landing() {
  const { perfil, cargando } = usePerfil();
  const { disponible } = useAcceso();

  // Quien ya tiene perfil no vuelve a ver la portada: va directo a lo suyo.
  if (perfil) return <Navigate to="/oportunidades" replace />;

  return (
    <Panel centrado>
      <PanelTitulo sobretitulo="Bolivia · becas, pasantias y empleo">
        Hola, soy Oppy.
      </PanelTitulo>

      <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-secondary">
        Te ayudo a encontrar oportunidades que se adapten a vos: empleo, cursos,
        becas o programas de crecimiento. Busco por mi cuenta y te aviso cuando
        encuentro algo — no hace falta que estes revisando.
      </p>

      <div className="mt-10 flex flex-col items-center gap-3">
        <Link to="/onboarding">
          <Button variante="primario" tamano="lg" disabled={cargando}>
            Empezar
            <Icono nombre="flecha-derecha" tamanio={18} />
          </Button>
        </Link>
        <p className="text-xs text-ink-secondary">Toma menos de un minuto. No pedimos CV ni documentos.</p>

        {/* Nunca compite con "Empezar": recuperar el acceso es el camino de
            quien ya paso por aca, no una alternativa para empezar. Solo aparece
            si el backend de acceso existe. */}
        {disponible && (
          <Link
            to="/acceso"
            className="min-h-[44px] text-sm text-ink-secondary underline underline-offset-2 hover:text-ink"
          >
            Ya usaste Oppy antes? Recupera tu perfil
          </Link>
        )}
      </div>

      <div className="mx-auto mt-12 max-w-lg border-t border-line-subtle pt-8">
        <p className="text-xs text-ink-secondary">Muy pronto vas a poder usarme desde:</p>
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {CANALES.map((canal) => (
            <li key={canal.texto}>
              <button
                type="button"
                disabled
                title="Muy pronto"
                className="inline-flex min-h-[44px] cursor-not-allowed items-center gap-2 rounded-full border border-line-subtle px-4 text-sm text-ink-secondary opacity-60"
              >
                <Icono nombre={canal.icono} tamanio={16} />
                {canal.texto}
                <span className="sr-only">— muy pronto</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
