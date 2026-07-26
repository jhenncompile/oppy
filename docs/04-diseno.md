# Fase 4 — Diseño (Figma)

Archivo: https://www.figma.com/design/q2aCurFwPXUrLeJKEX3Gl1/Oppy

Objetivo: llegar al desarrollo con pantallas y componentes tan definidos que
durante el build no se tome **ninguna** decisión visual.

## Principio rector

Cada pantalla debe hacer visible que **hay un agente pensando**. Si el
resultado se ve igual que una lista de Google, el trabajo técnico no se
percibe. Dos elementos cargan esa prueba: el **proceso en vivo** y el
**por qué calza**. Son los dos que más atención de diseño merecen.

## Pantallas (en orden de prioridad)

### P1 — Onboarding (3–4 campos)

Carrera · nivel de estudios · intereses · ubicación. Nada más.
Botón secundario "Contame hablando" para el modo voz (bonus).
Tono conversacional: "¿Qué estudiás?" en vez de "Carrera *".

### P2 — Proceso en vivo ⭐ (la más importante de la demo)

Mientras el agente trabaja, la pantalla narra lo que hace:

```
✓ Entendí tu perfil: Ing. de Sistemas, 4º año, La Paz
⟳ Generando búsquedas para tu perfil…
⟳ Buscando en: Embajada de Japón, AGCID, UPB…
· Analizando 34 resultados
· Evaluando compatibilidad
```

Un spinner genérico destruye la credibilidad; esta narración *es* la prueba
de que no está hardcodeado. Diseñar los estados de cada línea (pendiente,
en curso, completada, fallida) y qué pasa si una fuente no responde.

### P3 — Resultados

Lista ordenada por `match_score`, con contador ("12 oportunidades para vos")
y filtros por categoría. La card es el componente estrella del producto.

### P4 — Detalle de oportunidad

Requisitos, beneficio, deadline, fuente original con fecha de extracción,
CTA de aplicación, botones guardar/descartar (guardar funciona; el
aprendizaje es roadmap).

### P5 — Estados

Vacío ("todavía no encontré nada para este perfil" con acción sugerida),
error de fuente, sin conexión, cargando.

### P6 — Landing / portada *(opcional, solo si sobra tiempo)*

Sirve para el primer plano del pitch.

## Componente estrella: la card de oportunidad

Todo lo que diferencia a Oppy tiene que caber acá:

```
┌────────────────────────────────────────────────┐
│ 🟢 Verificada          Beca      cierra en 12d │
│                                                 │
│ Beca MEXT — Gobierno de Japón 2026              │
│ Embajada de Japón en Bolivia · hoy              │
│                                                 │
│ ▓▓▓▓▓▓▓▓▓░  92% compatible                      │
│                                                 │
│ 💡 Calza con vos porque estudiás Ing. de        │
│    Sistemas, pide 4º año o superior y tu        │
│    inglés B2 cumple el requisito mínimo.        │
│                                                 │
│              [ Ver detalle ]  [ ♡ Guardar ]     │
└────────────────────────────────────────────────┘
```

Jerarquía deliberada: la señal de confianza y el deadline arriba (lo que
genera urgencia y credibilidad), el score como barra + número, y el
`por_que_calza` con peso visual propio — no como letra chica. Ese bloque es
la salida del razonamiento del LLM y debe leerse como tal.

Variantes a modelar: confianza (3) × urgencia de deadline (normal / próximo
/ vencido) × estado (default / guardada / descartada).

## Fundaciones (hacer primero)

1. **Variables de Figma**, no estilos sueltos:
   - Color semántico: `surface/*`, `text/*`, `accent/*`, y **una escala
     propia para confianza** (`trust/verified`, `trust/pending`,
     `trust/stale`) y para el score.
   - Tipografía, espaciado (escala de 4), radios, sombras.
   - Modo claro y oscuro desde el inicio.
2. **Estructura del archivo**: `00 Cover` · `01 Foundations` ·
   `02 Components` · `03 Screens` · `04 Prototype` · `99 Archive`.
3. **Componentes base**: botón, input, select, chip/filtro, badge de
   confianza, barra de score, card, línea de log de proceso, estado vacío.
   Cada uno con sus estados (default, hover, focus, disabled, loading,
   error) y enlazado a variables — cero valores hardcodeados.

## Accesibilidad (requisito, no extra)

Oppy existe para cerrar una brecha de acceso; la interfaz no puede abrir
otra.

- Contraste AA mínimo — ojo especialmente con el semáforo de confianza:
  **nunca comunicar el estado solo con color**, siempre color + ícono +
  texto.
- Área táctil ≥44px, orden de foco lógico, todo operable por teclado.
- Estructura semántica pensada para lector de pantalla: la card debe leerse
  en un orden que tenga sentido escuchada, no solo vista.
- Modo voz (M9): definir cómo se ve la pantalla mientras escucha y cómo se
  confirma lo que entendió.

## Prototipo

Conectar P1 → P2 → P3 → P4 con el happy path del pitch. Es el respaldo si
la demo en vivo falla: un prototipo navegable siempre es mejor que una
pantalla en blanco frente al jurado.

## Checklist de salida

- [ ] Variables publicadas (color, tipografía, espaciado, confianza, score)
- [ ] Card de oportunidad con todas sus variantes
- [ ] P1–P5 en alta fidelidad
- [ ] Estados vacío / cargando / error de cada pantalla
- [ ] Prototipo del happy path navegable
- [ ] Contraste verificado y estados no dependientes solo del color
- [ ] Tokens exportables a código (para arrancar el frontend sin traducir)
