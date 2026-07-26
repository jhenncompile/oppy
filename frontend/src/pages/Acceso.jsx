import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Panel, PanelTitulo } from '../components/Panel.jsx';
import { Button } from '../components/Button.jsx';
import { Campo } from '../components/Campos.jsx';
import { useAcceso } from '../hooks/useAcceso.jsx';
import { usePerfil } from '../hooks/usePerfil.jsx';

const LARGO_CODIGO = 6;

/**
 * Recuperar el acceso a un perfil que ya existe.
 *
 * No es un login: nadie pasa por aca para empezar a usar Oppy. Es para cuando
 * la persona limpio el navegador, cambio de telefono o esta en una computadora
 * prestada — hoy eso significa perder el perfil sin aviso.
 *
 * Sin contrasenia a proposito: se manda un codigo al contacto que ya dejo para
 * las notificaciones. Una contrasenia mas es una barrera mas para alguien que
 * ya siente que las plataformas son complicadas.
 */
export function Acceso() {
  const { disponible, comprobando, pedirCodigo, canjearCodigo } = useAcceso();
  const { perfil, guardar } = usePerfil();
  const navegar = useNavigate();

  const [contacto, setContacto] = useState('');
  const [codigo, setCodigo] = useState('');
  const [etapa, setEtapa] = useState('contacto');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  // Quien ya tiene perfil no necesita recuperarlo.
  if (perfil) return <Navigate to="/oportunidades" replace />;

  if (comprobando) {
    return (
      <Panel centrado>
        <div className="h-6 w-48 animate-pulse rounded bg-surface-hover" />
      </Panel>
    );
  }

  // El backend todavia no existe: se dice de frente y se ofrece la salida que
  // si funciona, en vez de dejar a la persona en un callejon.
  if (!disponible) {
    return (
      <Panel centrado>
        <PanelTitulo sobretitulo="Acceso">Todavia no puedo recuperar tu perfil</PanelTitulo>
        <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-ink-secondary">
          Estoy trabajando en esto. Por ahora, si perdiste tu perfil, lo mas
          rapido es armarlo de nuevo — toma menos de un minuto.
        </p>
        <div className="mt-8">
          <Button variante="primario" tamano="lg" onClick={() => navegar('/onboarding')}>
            Armar mi perfil
          </Button>
        </div>
      </Panel>
    );
  }

  const enviarCodigo = async () => {
    setEnviando(true);
    setError(null);
    try {
      await pedirCodigo(contacto.trim());
      setEtapa('codigo');
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setEnviando(false);
    }
  };

  const entrar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const { perfil: recuperado } = await canjearCodigo(contacto.trim(), codigo.trim());
      guardar(recuperado);
      navegar('/oportunidades', { replace: true });
    } catch {
      // El mensaje del servidor no se muestra crudo: se traduce a algo que la
      // persona pueda accionar.
      setError('Ese codigo no es valido o ya vencio. Pedi uno nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Panel centrado>
      <PanelTitulo sobretitulo="Acceso">
        {etapa === 'contacto' ? 'Volvamos a tu perfil' : 'Revisa tu correo'}
      </PanelTitulo>

      <div className="mx-auto mt-8 w-full max-w-md text-left">
        {etapa === 'contacto' ? (
          <>
            <p className="mb-6 text-base leading-relaxed text-ink-secondary">
              Escribi el correo o el telefono que dejaste cuando armaste tu
              perfil. Te mando un codigo — no hace falta contrasenia.
            </p>

            <Campo
              nombre="contacto"
              etiqueta="Tu correo o telefono"
              placeholder="vos@correo.com"
              valor={contacto}
              onCambiar={(e) => setContacto(e.target.value)}
            />

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                variante="primario"
                tamano="lg"
                onClick={enviarCodigo}
                disabled={!contacto.trim() || enviando}
              >
                {enviando ? 'Enviando…' : 'Mandame el codigo'}
              </Button>
              <button
                type="button"
                onClick={() => navegar('/onboarding')}
                className="min-h-[44px] text-sm text-ink-secondary underline underline-offset-2 hover:text-ink"
              >
                Mejor armo uno nuevo
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-6 text-base leading-relaxed text-ink-secondary">
              Te mande un codigo de {LARGO_CODIGO} digitos a{' '}
              <strong className="text-ink">{contacto}</strong>. Vence en diez minutos.
            </p>

            <Campo
              nombre="codigo"
              etiqueta="El codigo que te llego"
              placeholder="000000"
              inputMode="numeric"
              maxLength={LARGO_CODIGO}
              valor={codigo}
              onCambiar={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            />

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                variante="primario"
                tamano="lg"
                onClick={entrar}
                disabled={codigo.length !== LARGO_CODIGO || enviando}
              >
                {enviando ? 'Entrando…' : 'Entrar'}
              </Button>
              <button
                type="button"
                onClick={() => { setEtapa('contacto'); setCodigo(''); setError(null); }}
                className="min-h-[44px] text-sm text-ink-secondary underline underline-offset-2 hover:text-ink"
              >
                No me llego
              </button>
            </div>
          </>
        )}

        {error && (
          <p className="mt-6 text-sm text-trust-stale-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </Panel>
  );
}
