import { useState } from 'react';
import { Button } from './Button.jsx';
import { Campo } from './Campos.jsx';
import { Icono } from './Icono.jsx';

/**
 * Anotar una oportunidad que la persona encontro por su cuenta.
 *
 * Un solo campo obligatorio, y es a proposito. Mucho de lo que la gente quiere
 * anotar viene de un mensaje de WhatsApp, de un cartel o de un dato que le
 * pasaron: no tiene enlace, ni organizacion, ni fecha. Un formulario que exige
 * todo eso es un formulario que se abandona, y la oportunidad se pierde igual
 * que si Oppy no existiera.
 *
 * El campo "donde" existe justamente para lo que no tiene URL. Que alguien
 * pueda escribir "me lo paso mi vecina" es la diferencia entre servir al
 * mercado formal y servir al que de verdad mueve el empleo en Bolivia.
 */
const VACIO = {
  titulo: '',
  organizacion: '',
  enlace: '',
  donde: '',
  fechaLimite: '',
  notas: ''
};

export function FormularioPropia({ onGuardar, onCancelar }) {
  const [valores, setValores] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const set = (campo) => (evento) =>
    setValores((previos) => ({ ...previos, [campo]: evento.target.value }));

  const enviar = async (evento) => {
    evento.preventDefault();
    if (!valores.titulo.trim() || guardando) return;

    setGuardando(true);
    setError(null);

    try {
      // Los vacios no viajan: el backend los trata como ausentes, y mandar ""
      // haria fallar la validacion del enlace.
      const datos = Object.fromEntries(
        Object.entries(valores)
          .map(([clave, valor]) => [clave, valor.trim()])
          .filter(([, valor]) => valor.length > 0)
      );

      await onGuardar(datos);
      setValores(VACIO);
      onCancelar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form
      onSubmit={enviar}
      className="mb-8 flex flex-col gap-5 rounded-xl border border-line-subtle bg-surface-subtle p-5"
    >
      <div>
        <h3 className="text-base font-semibold text-ink">Anotar una oportunidad</h3>
        <p className="mt-1 text-sm text-ink-secondary">
          Algo que encontraste: un aviso que te llego, un dato que te pasaron,
          un puesto que viste en otro lado. Queda solo para ti.
        </p>
      </div>

      <Campo
        nombre="titulo"
        etiqueta="De que se trata"
        placeholder="Ayudante de cocina en un restaurante del centro"
        valor={valores.titulo}
        onCambiar={set('titulo')}
        required
        maxLength={160}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Campo
          nombre="organizacion"
          etiqueta="Quien la ofrece"
          opcional
          placeholder="Nombre del lugar o la empresa"
          valor={valores.organizacion}
          onCambiar={set('organizacion')}
          maxLength={120}
        />

        <Campo
          nombre="fechaLimite"
          etiqueta="Hasta cuando"
          ayuda="Si la pones, te aviso antes de que cierre."
          opcional
          type="date"
          valor={valores.fechaLimite}
          onCambiar={set('fechaLimite')}
        />
      </div>

      <Campo
        nombre="enlace"
        etiqueta="Enlace"
        opcional
        type="url"
        placeholder="https://..."
        valor={valores.enlace}
        onCambiar={set('enlace')}
        maxLength={500}
      />

      <Campo
        nombre="donde"
        etiqueta="De donde salio"
        ayuda="Para lo que no tiene enlace: quien te lo paso, o donde lo viste."
        opcional
        placeholder="Me lo paso una conocida"
        valor={valores.donde}
        onCambiar={set('donde')}
        maxLength={160}
      />

      <Campo
        nombre="notas"
        etiqueta="Notas"
        opcional
        valor={valores.notas}
        onCambiar={set('notas')}
        hijos={
          <textarea
            id="notas"
            name="notas"
            rows={3}
            value={valores.notas}
            onChange={set('notas')}
            maxLength={1000}
            placeholder="Preguntar por Marta. Piden experiencia."
            className="rounded-md border border-line-subtle bg-surface-card px-4 py-3 text-ink placeholder:text-ink-secondary focus:border-line-accent focus:outline-none"
          />
        }
      />

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-trust-stale-text">
          <Icono nombre="alerta" tamanio={15} />
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variante="secundario" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" variante="acento" disabled={!valores.titulo.trim() || guardando}>
          <Icono nombre="marcador" tamanio={15} />
          {guardando ? 'Guardando…' : 'Guardar en mi libreta'}
        </Button>
      </div>
    </form>
  );
}
