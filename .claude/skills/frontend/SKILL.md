---
name: frontend
description: Construir o modificar interfaz de Oppy — componentes React, pantallas, estilos, copy visible al usuario, accesibilidad y responsive. Usar siempre que se toque frontend/, se escriba texto que el usuario vaya a leer, o se decida cómo se ve o se comporta algo en pantalla.
---

# Frontend de Oppy

## Regla cero: ante la duda, preguntá

**No implementes una decisión de diseño o de producto que no esté escrita.** Si
al ir a codear te encontrás eligiendo entre dos comportamientos razonables,
parás y preguntás. Una pregunta cuesta treinta segundos; una pantalla rehecha
cuesta una tarde, y una decisión de diseño tomada en un diff no queda registrada
en ningún lado.

Preguntá siempre antes de:

- Inventar un estado que no está definido (vacío, error, cargando, parcial)
- Elegir entre dos flujos posibles cuando el doc no dice cuál
- Agregar un campo, un filtro, un botón o una pantalla que nadie pidió
- Cambiar el significado de un color o crear un color nuevo
- Escribir copy que afirme algo del producto que no sabés si es cierto
- Resolver una ambigüedad "como se hace normalmente"

No preguntes por: espaciados concretos, nombres de variables, cómo partir un
componente, o cualquier cosa que ya esté resuelta en un archivo vecino.

Cuando preguntes, traé una recomendación. "¿A o B?" es peor que "haría A porque
X, ¿lo confirmás?".

## La frontera: el frontend no decide

Está en [`docs/09-flujo-producto.md`](../../../docs/09-flujo-producto.md).

**Si tuviste que decidir qué oportunidad es mejor, invadiste al agente.**

El frontend construye el perfil y presenta. No busca, no evalúa, no calcula
confianza, no redacta los mensajes de acompañamiento y nunca llama al modelo.
Ordenar por una columna que ya viene calculada sí es su trabajo.

## El usuario nunca ve "agentes"

Usa Oppy. Por detrás los agentes trabajan, pero eso es organización interna
nuestra y no se filtra a la pantalla. Nunca escribas "el Matching Agent
determinó", "nuestros agentes", "el LLM", "el pipeline", "el scoring".

Excepción única y deliberada: la **pantalla de proceso en vivo**, donde se narra
lo que Oppy está haciendo. Ahí el sujeto es siempre Oppy, en singular, en
lenguaje de persona: *"Estoy revisando la Embajada de Japón"*, no *"Explorer
Agent: scraping source 3/5"*.

## Copy

Mucha gente que va a usar Oppy nunca usó un producto con agentes. Si el copy
suena a herramienta técnica, se van antes de ver el valor.

**Reglas:**

- Segunda persona, trato de vos. Tono acompañante, no buscador.
- Frases cortas. Si una oración necesita una coma para respirar, partila.
- Nada de jerga: sin "match", "score", "query", "parsear", "índice", "token".
- Los números se explican solos. `82%` sin contexto no dice nada; `82% compatible` sí.
- Un error dice qué pasó y qué hacer. Nunca solo qué falló.
- Nunca culpes al usuario. "No encontramos nada todavía", no "tu búsqueda no arrojó resultados".
- Los estados vacíos proponen una acción. Un vacío sin salida es un callejón.

**Antes → después:**

| ✖ | ✔ |
|---|---|
| "Sin resultados" | "Todavía no encontré nada para tu perfil. Voy a seguir buscando y te aviso." |
| "Error 500" | "Algo se rompió de nuestro lado. Probá de nuevo en un momento." |
| "Ejecutando query semántica..." | "Estoy buscando en las páginas de embajadas y universidades." |
| "Match score: 92" | "92% compatible con vos" |
| "Campos requeridos incompletos" | "Me falta saber dónde vivís para buscarte cosas cerca." |
| "Procesando..." | "Dame unos segundos, estoy leyendo las convocatorias." |

**El bloque de razones es el corazón del producto.** Es la salida del
razonamiento y tiene que leerse como tal: peso visual propio, nunca letra chica,
nunca colapsado por defecto.

## Diseño

**Referencia visual:** `estilo_de_pagina_efecto.png` en la raíz — paneles
grandes muy redondeados, flotando sobre un fondo cálido, con mucho aire.

**Paleta:** [`docs/04-diseno.md`](../../../docs/04-diseno.md) tiene los valores.
Escalas de 12 pasos donde el paso indica el uso: `1–2` fondos · `3–5`
componentes interactivos · `6–8` bordes · `9–10` sólidos · `11–12` texto
accesible.

**Regla dura: ningún componente escribe un color, un radio o una fuente.** Todo
sale de las clases de Tailwind que apuntan a las variables de `tokens.css`, que
son las mismas que las variables de Figma. Si necesitás un valor que no existe,
se agrega al token — no al componente.

```jsx
✖  <div className="bg-[#f8f8f9] rounded-[32px] text-[#5d5f67]">
✔  <div className="panel text-ink-secondary">
```

Tampoco uses un primitivo directo (`blue-9`, `gray-11`). Solo semánticos:
`surface-*`, `ink-*`, `line-*`, `accent`, `trust-*`, `score-*`.

## Responsive, siempre

No es una pasada al final. Se escribe móvil primero y se verifica en 360px antes
de dar algo por hecho.

- Empezá por la clase base (móvil) y agregá `sm:` / `lg:` hacia arriba
- Nada de anchos fijos en píxeles; `max-width` + `width: 100%`
- Tablas, código y diagramas anchos scrollean en su propio contenedor — el body nunca scrollea en horizontal
- Área táctil mínima de 44px
- Verificá 360px, 768px y 1280px

## Accesibilidad — requisito, no extra

Oppy existe para cerrar una brecha de acceso; la interfaz no puede abrir otra.
Es una de las decisiones que no se negocian del plan maestro.

- **Contraste AA.** Ojo con `ink-muted`: da 3.9:1, solo sirve para texto grande.
- **Nunca comunicar estado solo con color.** El semáforo de confianza va siempre color + ícono + texto. Un usuario con daltonismo tiene que leer "Verificada".
- Todo operable por teclado, con orden de foco lógico y `:focus-visible` visible.
- `<label>` real asociado a cada campo; nada de placeholders como etiqueta.
- Estructura semántica pensada para lector de pantalla: la card debe tener sentido escuchada, no solo vista.
- Respetá `prefers-reduced-motion` (ya está en `index.css`).

## Convenciones

- ESM, imports con extensión `.js` / `.jsx`
- Identificadores de dominio en español: `perfil`, `fechaLimite`, `compatibilidad`
- Comentarios de código sin tildes; los `.md` sí las llevan
- Los comentarios explican el porqué, no el qué
- Sin linter: se imita el estilo del archivo vecino
- Componentes en `components/`, pantallas en `pages/`, llamadas HTTP solo en `api/client.js`

## Antes de dar algo por terminado

- [ ] Se ve bien en 360px
- [ ] Ningún color, radio ni fuente escrito a mano
- [ ] Contraste AA verificado en texto nuevo
- [ ] Los estados vacío, cargando y error existen y proponen una salida
- [ ] El copy no tiene jerga y trata de vos
- [ ] Ningún estado se comunica solo con color
- [ ] Navegable por teclado
