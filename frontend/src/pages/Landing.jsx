import { Link, Navigate } from 'react-router-dom';
import { Button } from '../components/Button.jsx';
import { Logo } from '../components/Logo.jsx';
import { Icono } from '../components/Icono.jsx';
import { usePerfil } from '../hooks/usePerfil.jsx';

/**
 * Portada.
 *
 * Una sola pantalla, dos caminos y nada mas. Quien llega no sabe todavia que es
 * Oppy, y una portada larga le pide leer antes de dejarlo probar — que es lo
 * contrario de lo que necesita alguien que entra a buscar trabajo.
 */

/**
 * Los canales que todavia no existen se muestran igual, apagados.
 *
 * No es decoracion: son la promesa de accesibilidad del producto. Mucha gente
 * en Bolivia vive en el telefono y no abre una pagina web, asi que decir a
 * donde va a llegar Oppy importa. Esconderlo hasta que este listo es decirle a
 * quien lo necesita que no fue pensado para ella.
 *
 * Van desactivados y dicen "Proximamente" a proposito: prometer un canal que no
 * responde es peor que no ofrecerlo, sobre todo para alguien que ya desconfia
 * de las plataformas.
 */
const CANALES = [
  { icono: 'enviar', texto: 'Telegram' },
  { icono: 'mensaje', texto: 'WhatsApp' },
  { icono: 'microfono', texto: 'Por voz' }
];

const PUNTOS = [
  {
    icono: 'lupa',
    titulo: 'Busca por su cuenta',
    texto: 'Revisa fuentes bolivianas todos los dias, sin que tengas que entrar.'
  },
  {
    icono: 'chispas',
    titulo: 'Explica cada resultado',
    texto: 'Te dice por que una convocatoria calza con tu perfil, y que te falta.'
  },
  {
    icono: 'escudo',
    titulo: 'Marca de donde salio',
    texto: 'Cada oportunidad muestra su fuente y si el plazo sigue vigente.'
  }
];

export function Landing() {
  const { perfil, cargando } = usePerfil();

  // Quien ya tiene perfil no vuelve a ver la portada: va directo a lo suyo.
  if (perfil) return <Navigate to="/oportunidades" replace />;

  return (
    <div className="flex flex-col gap-3 sm:gap-6">
      <section className="panel px-5 py-12 text-center sm:px-12 sm:py-16">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
          <Logo tamanio="lg" animado />

          <h1 className="mt-8 text-balance font-display text-3xl font-bold leading-tight text-ink sm:text-4xl md:text-5xl">
            Las oportunidades existen. Encontrarlas es el problema.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-secondary sm:text-lg">
            Soy Oppy. Busco becas, empleos, cursos y convocatorias en Bolivia, y
            te explico por que cada una tiene sentido para tu perfil.
          </p>

          {/* Los dos caminos, uno al lado del otro. En movil se apilan y el de
              probar queda arriba: es el que sirve a quien llega por primera vez. */}
          <div className="mt-10 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
            <Link to="/onboarding" className="w-full sm:w-auto">
              <Button variante="primario" tamano="lg" disabled={cargando} className="w-full sm:w-auto">
                Probar la demo
                <Icono nombre="flecha-derecha" tamanio={18} />
              </Button>
            </Link>

            <Link to="/acceso" className="w-full sm:w-auto">
              <Button variante="secundario" tamano="lg" className="w-full sm:w-auto">
                <Icono nombre="escudo" tamanio={18} />
                Iniciar sesion
              </Button>
            </Link>
          </div>

          <p className="mt-4 text-sm text-ink-secondary">
            La demo toma menos de un minuto. No pedimos CV ni documentos.
          </p>

          <div className="mt-12 w-full border-t border-line-subtle pt-8">
            <p className="text-xs text-ink-secondary">Pronto vas a poder usarme desde:</p>
            <ul className="mt-4 flex flex-wrap justify-center gap-2">
              {CANALES.map((canal) => (
                <li key={canal.texto}>
                  <span className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line-subtle px-4 text-sm text-ink-secondary opacity-70">
                    <Icono nombre={canal.icono} tamanio={16} />
                    {canal.texto}
                    <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-medium">
                      Proximamente
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="panel px-5 py-10 sm:px-12 sm:py-12">
        <ul className="mx-auto grid w-full max-w-4xl gap-8 sm:grid-cols-3 sm:gap-6">
          {PUNTOS.map((punto) => (
            <li key={punto.titulo} className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-accent text-ink-accent">
                <Icono nombre={punto.icono} tamanio={20} />
              </span>
              <h2 className="text-base font-semibold text-ink">{punto.titulo}</h2>
              <p className="text-sm leading-relaxed text-ink-secondary">{punto.texto}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
