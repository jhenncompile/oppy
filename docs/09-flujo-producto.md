# Fase 9 — Flujo del producto

Los documentos [1](01-problema.md) y [2](02-solucion.md) describen el problema y
el loop del agente. Este describe **lo que el usuario vive**, y traza la
frontera entre producto y agente — que hasta ahora estaba implícita y por eso se
mezclaba.

## El principio que ordena todo

> El usuario nunca siente que habla con varios agentes. Usa Oppy. Por detrás,
> los agentes trabajan.

Y su consecuencia, que es la decisión de producto más fuerte de este documento:

> **Después del onboarding, el usuario no vuelve a buscar.**

El centro del producto no es un buscador con resultados: es un **tablero
personal de oportunidades** que se actualiza solo. El usuario revisa, organiza y
decide a cuáles darle seguimiento. Buscar es trabajo del agente, no del usuario.

Esto no es una preferencia estética. Un buscador se juzga por sus resultados; un
agente se juzga por lo que hace cuando no lo estás mirando.

## La frontera

| | Frontend (producto) | Agente (backend) |
|---|---|---|
| Perfil | **Lo construye** | Lo recibe, nunca lo crea |
| Búsqueda | No busca | Decide qué buscar y lo ejecuta |
| Evaluación | No evalúa | Razona compatibilidad y brechas |
| Confianza | La muestra | La calcula (con reglas, no con el modelo) |
| Seguimiento | Lo captura como estado | Reacciona a los cambios de estado |
| Recordatorios | Los muestra | Los genera |
| Presentación | **Toda suya** | Devuelve datos, nunca interfaz |

Regla operativa para quien escribe frontend: **si tuviste que decidir qué
oportunidad es mejor, invadiste el agente.** Regla para quien escribe el agente:
**si tu salida trae texto para pintar en pantalla, invadiste el producto.**

---

# 1. Primer contacto

| Canal | Estado |
|---|---|
| Web responsive | MVP |
| Aplicación móvil | Futuro |
| WhatsApp / Telegram | Futuro |
| Interacción por voz | Accesibilidad — bonus |

> "Hola, soy Oppy. Te ayudaré a encontrar oportunidades que se adapten a tu
> perfil y acompañarte durante el proceso."

Tono: acompañante, no buscador.

---

# 2. Perfil (lo construye el frontend)

Acá **no trabaja el agente**. El frontend recoge información estructurada y
produce el Perfil Base, que después es el contexto permanente del agente. El
usuario lo puede editar cuando quiera.

## Básicos

Nombre · edad *(opcional)* · ubicación · idioma preferido

## Objetivo principal

Una sola elección, editable después desde el perfil:

💼 Encontrar empleo · 🔄 Reinsertarme laboralmente · 🎓 Becas ·
📚 Cursos y certificaciones · 🚀 Crecimiento profesional · 🤝 Voluntariados ·
🏆 Eventos y hackathons

El objetivo es la señal más fuerte que recibe el agente: **acota qué buscar
antes de mirar cualquier otra cosa del perfil.**

## Experiencia

Trabajo formal · emprendimientos · voluntariado · **experiencia familiar** ·
proyectos personales · otro

"Experiencia familiar" está a propósito. Es lo que separa a Oppy de un portal de
empleo: para María, veinte años administrando una casa **son** experiencia
administrativa, y ningún formulario tradicional se lo reconoce.

## Habilidades

Texto libre o selección rápida. El agente puede enriquecerlas después
detectando habilidades implícitas — pero eso es enriquecimiento, no captura.

## Restricciones y preferencias

La sección que más pesa para la inclusión, y la que ningún competidor pide:

Horario disponible · trabajo remoto · distancia máxima · **necesidad económica
inmediata** · requiere accesibilidad · interacción por voz · otros

Una convocatoria perfecta a 40 km de alguien sin transporte no es una
oportunidad. Sin estos campos, el agente no puede saberlo.

---

# 3. El tablero

Lo que el usuario ve al entrar, siempre. No una lista infinita.

### Nuevas oportunidades

Lo que el agente encontró desde la última vez. Cada tarjeta: título ·
organización · compatibilidad · fecha límite · modalidad · fuente · **por qué
calza** · ver detalles.

### Guardadas

Marcar para seguir sin tener que aplicar ahora. Guardar no es aplicar, y el
producto no debe empujar a confundirlos.

### Mi seguimiento

Cada oportunidad tiene un estado que avanza:

⭐ Guardada → 📝 Preparando aplicación → 📤 Aplicada → 🎤 Entrevista →
✅ Finalizada

Y en cualquier momento: ✖ Descartada.

### Calendario

Todas las fechas relevantes, automáticas: cierre de convocatoria · entrevistas ·
inicio de programas · recordatorios. Integración con Google Calendar / Outlook
como paso posterior.

### Checklist por oportunidad

```
Programa XYZ
  ✔ CV
  ✔ Portafolio
  ☐ Carta de motivación
  ☐ Certificado de idioma
```

El checklist sale de los requisitos que extrajo el agente, pero **lo marca el
usuario**. Es donde la brecha detectada ("te falta certificación de inglés") se
convierte en algo accionable.

---

# 4. Acompañamiento

El único momento en que Oppy "habla". Siempre gatillado por un hecho, nunca por
un turno de conversación:

> "Encontré una oportunidad muy similar a la que guardaste."
> "La convocatoria cierra en tres días."
> "Todavía falta subir tu carta de motivación."
> "Encontré un curso gratuito que puede aumentar tu compatibilidad."

Estos mensajes los **genera el agente** y los **presenta el frontend**. El
frontend no los redacta.

---

# 5. Arquetipos

Tres entradas al mismo motor. No son tres productos.

| | **Diego** — primera oportunidad | **María** — transición laboral | **Ana** — mantenerse al día |
|---|---|---|---|
| **Objetivo** | Entrar al mundo profesional | Reinsertarse al mercado | No perder oportunidades de crecimiento |
| **Busca** | Pasantías, primer empleo, becas, hackathons, bootcamps | Empleos, capacitación, cursos, cerca de casa | Becas, eventos, conferencias, comunidades, convocatorias |
| **Dolor** | No sabe dónde buscar; cree que se pierde cosas; no tiene experiencia | Perdió su empleo; no domina plataformas digitales; necesita acompañamiento | Demasiadas fuentes; se entera cuando ya cerró; sin tiempo para revisar sitios |
| **Qué le exige al producto** | Que no pida experiencia previa como filtro | Que reconozca experiencia no formal y respete restricciones | Que sea proactivo — ella no va a entrar a buscar |

Ana es la prueba más dura del principio de este documento: **si tiene que entrar
a buscar, Oppy no le sirve.**

---

# 6. Accesibilidad

Transversal, no un arquetipo ni una fase posterior.

Navegación por voz · lectura automática de oportunidades · lenguaje claro ·
interfaz simplificada · compatibilidad con tecnologías de asistencia.

Beneficia especialmente a personas mayores, personas con discapacidad visual y
usuarios con baja alfabetización digital. Coherente con la cuarta decisión del
[plan maestro](00-plan-maestro.md): si Oppy existe para cerrar una brecha de
acceso, la interfaz no puede abrir otra.

---

# 7. Lo que el frontend nunca hace

- Decidir qué oportunidad es mejor
- Filtrar por relevancia *(ordenar por una columna que ya viene calculada, sí)*
- Redactar los mensajes de acompañamiento
- Llamar al modelo
- Escribir en el índice de oportunidades

---

# 8. Lo que esto cambia de lo ya construido

Estado: **✅ existe** · **◐ parcial** · **○ falta**.

| Área | Hoy | Este documento pide | Δ |
|---|---|---|---|
| Perfil | `carrera`, `nivel_estudios`, `intereses[]`, `ubicacion`, `idiomas` | + `objetivo`, `experiencia[]`, `habilidades[]`, `preferencias{}`, `restricciones[]`, `edad`, `idioma` | ○ migración de `users` |
| Categorías | beca, pasantía, empleo, intercambio, concurso, financiamiento, curso | + voluntariado, evento *(hackathons, conferencias)*, programa social | ○ ampliar enum y `CHECK` |
| Seguimiento | `nuevo`, `visto`, `guardado`, `descartado` | + `preparando`, `aplicada`, `entrevista`, `finalizada` | ○ ampliar `CHECK` (aditivo) |
| Razones y brechas | prosa en un solo campo | `razones[]` + `brechas[]` | ✅ hecho — ver `schema.sql` |
| Checklist | — | Ítems por oportunidad, marcables | ○ tabla nueva |
| Calendario | `fecha_limite` en el índice | Vista agregada + recordatorios | ◐ el dato está; falta la vista |
| Tarjeta | título, categoría, confianza, score, por qué | + organización, modalidad | ◐ `fuente_nombre` existe; `modalidad` no |
| Dashboard proactivo | Se dispara con un botón | Se actualiza solo | ◐ el cron ya existe; falta que el tablero sea la entrada |

**Los que quedan rompen contratos congelados** y por lo tanto necesitan spec
antes de código, según [`CLAUDE.md`](../CLAUDE.md): el esquema de perfil, la
`modalidad` de la oportunidad y el enum de categorías.

El renombre a `compatibilidad` / `razones[]` y el agregado de `brechas[]` ya
están aplicados, con migración idempotente en `backend/src/db/schema.sql`: el
texto que existía se conserva como primer elemento del arreglo.
