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

Lista ordenada por `compatibilidad`, con contador ("12 oportunidades para vos")
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
│ POR QUÉ CALZA CON VOS                           │
│  ✓ Pide 4º año o superior, y estás ahí          │
│  ✓ Tu inglés B2 cumple el mínimo que exige      │
│  ✓ Prioriza carreras STEM, como la tuya         │
│ PARA POSTULAR TE FALTA                          │
│  ○ Certificado de promedio 70/100               │
│                                                 │
│              [ Ver detalle ]  [ ♡ Guardar ]     │
└────────────────────────────────────────────────┘
```

Jerarquía deliberada: la señal de confianza y el deadline arriba (lo que
genera urgencia y credibilidad), el score como barra + número, y el
las `razones` con peso visual propio — no como letra chica. Ese bloque es
la salida del razonamiento del LLM y debe leerse como tal. Las `brechas` van
justo debajo, separadas: son lo que la persona puede accionar, y alimentan el
checklist de la oportunidad.

Variantes a modelar: confianza (3) × urgencia de deadline (normal / próximo
/ vencido) × estado (default / guardada / descartada).

## Paleta

Fuente de verdad de los valores. Está acá **además** de en Figma y en
`frontend/src/styles/tokens.css` porque una paleta que solo vive en un archivo
de diseño se pierde en cuanto alguien no lo tiene abierto.

Escalas de 12 pasos. El paso indica el uso, no la oscuridad: `1–2` fondos ·
`3–5` componentes interactivos · `6–8` bordes y separadores · `9–10` sólidos ·
`11–12` texto accesible.

| Paso | Acento | Gris | | Paso | Acento | Gris |
|---|---|---|---|---|---|---|
| 1 | `#f6f9fa` | `#f8f8f9` | | 7 | `#8ac3de` | `#c7c9d1` |
| 2 | `#eff5f9` | `#f4f5f7` | | 8 | `#5badd1` | `#b3b5c1` |
| 3 | `#def0f9` | `#ebebef` | | 9 | `#49a0c5` | `#868893` |
| 4 | `#cde9f7` | `#e2e3e8` | | 10 | `#3c94b8` | `#7b7d87` |
| 5 | `#bae0f2` | `#dbdce1` | | 11 | `#0d7396` | `#5d5f67` |
| 6 | `#a5d3ea` | `#d3d4db` | | 12 | `#1a3b4a` | `#1e1f24` |

Fondo de página: `#fffafa` — el blanco cálido que da el carácter de la
referencia visual.

Cada escala tiene su variante alpha (`--blue-a1` … `--gray-a12`), para tintar
sobre superficies que no son el fondo de página. Los valores están en
`tokens.css`.

**Lo que esta paleta todavía no cubre:**

- **Modo oscuro** — la exportación trajo solo el modo claro. Las escalas
  oscuras de `tokens.css` son las de arranque y no son la contraparte de estas.
- **Semáforo de confianza** — verde, ámbar y rojo siguen con los valores de
  arranque. Son los tres colores que más peso comunican en el producto, así que
  conviene definirlos a propósito y no heredarlos.

### Contraste verificado

Medido sobre `--surface-card` (`#f8f8f9`), que es el fondo real de los paneles:

| Uso | Color | Contraste | AA |
|---|---|---|---|
| Texto principal | gris 12 | 15.6:1 | ✅ |
| Texto secundario | gris 11 | 6.0:1 | ✅ |
| Texto de acento | acento 11 | 5.1:1 | ✅ |
| Texto atenuado | gris 10 | 3.9:1 | ⚠️ solo texto grande |
| Blanco sobre botón sólido | acento 9 | 2.9:1 | ❌ |

Los dos últimos son deuda conocida, no un descuido de la paleta: el paso 9 de
una escala está pensado para rellenos, no para llevar texto encima. El arreglo
es de una línea — apuntar `--accent-solid` al paso 11 para los botones que
llevan texto — pero cambia el aspecto del botón primario, así que es decisión
de diseño y no se toma en un diff.

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
