import { useState } from 'react';
import { Button } from '../components/Button.jsx';

const CAMPOS = [
  {
    nombre: 'carrera',
    etiqueta: 'Que estudias o estudiaste',
    placeholder: 'Ingenieria de Sistemas',
    requerido: true
  },
  {
    nombre: 'nivelEstudios',
    etiqueta: 'En que punto estas',
    placeholder: '4to ano de universidad',
    requerido: true
  },
  {
    nombre: 'ubicacion',
    etiqueta: 'Donde vivis',
    placeholder: 'Santa Cruz, Bolivia',
    requerido: true
  },
  {
    nombre: 'intereses',
    etiqueta: 'Que te interesa',
    placeholder: 'inteligencia artificial, intercambios, emprendimiento',
    ayuda: 'Separalos con comas',
    requerido: false
  }
];

const INICIAL = { carrera: '', nivelEstudios: '', ubicacion: '', intereses: '' };

/**
 * Cuatro campos y nada mas. Cada campo extra es gente que abandona antes de
 * ver el valor — y el valor de Oppy solo se ve del otro lado del formulario.
 */
export function Onboarding({ onEnviar, enviando }) {
  const [valores, setValores] = useState(INICIAL);

  const actualizar = (nombre) => (evento) =>
    setValores((previos) => ({ ...previos, [nombre]: evento.target.value }));

  const enviar = (evento) => {
    evento.preventDefault();
    onEnviar({
      carrera: valores.carrera.trim(),
      nivelEstudios: valores.nivelEstudios.trim(),
      ubicacion: valores.ubicacion.trim(),
      intereses: valores.intereses
        .split(',')
        .map((interes) => interes.trim())
        .filter(Boolean),
      idiomas: []
    });
  };

  const completo = valores.carrera && valores.nivelEstudios && valores.ubicacion;

  return (
    <form onSubmit={enviar} className="mx-auto flex w-full max-w-xl flex-col gap-5">
      {CAMPOS.map((campo) => (
        <div key={campo.nombre} className="flex flex-col gap-1.5 text-left">
          <label htmlFor={campo.nombre} className="text-sm font-medium text-ink">
            {campo.etiqueta}
            {!campo.requerido && (
              <span className="ml-2 font-normal text-ink-muted">opcional</span>
            )}
          </label>
          <input
            id={campo.nombre}
            name={campo.nombre}
            value={valores[campo.nombre]}
            onChange={actualizar(campo.nombre)}
            placeholder={campo.placeholder}
            required={campo.requerido}
            aria-describedby={campo.ayuda ? `${campo.nombre}-ayuda` : undefined}
            className="rounded-md border border-line-subtle bg-surface-card px-4 py-3 text-ink placeholder:text-ink-muted focus:border-line-accent focus:outline-none"
          />
          {campo.ayuda && (
            <p id={`${campo.nombre}-ayuda`} className="text-xs text-ink-muted">
              {campo.ayuda}
            </p>
          )}
        </div>
      ))}

      <Button type="submit" variante="primario" tamano="lg" disabled={!completo || enviando}>
        {enviando ? 'Buscando…' : 'Buscar oportunidades para mi'}
      </Button>
    </form>
  );
}
