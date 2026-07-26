# Fase 1 — Definición de problema

## Enunciado

> Existen oportunidades, pero las personas no saben dónde están, se enteran
> tarde, o simplemente nunca llegan a conocerlas.

En Bolivia y LatAm se publican cada semana cientos de becas, pasantías,
empleos, intercambios, concursos y fondos, dispersos en portales
universitarios, embajadas, ONGs, fundaciones, aceleradoras, LinkedIn y redes
sociales institucionales. Nadie tiene tiempo de rastrearlos todos.

**El costo no es falta de mérito, es falta de descubrimiento.**

## Las dos capas del problema

| Capa | Formulación | Para quién pesa |
|------|-------------|-----------------|
| Funcional | La información está fragmentada y no llega a tiempo | Jurado técnico, usuarios activos |
| Emocional | La ansiedad de estar perdiéndose algo que podría cambiar tu vida | Pitch, impacto social |

La capa emocional es la que hace que el producto importe; la funcional es la
que se puede medir. El pitch abre con la primera y demuestra con la segunda.

## Usuario objetivo

Tres arquetipos. **No son tres productos**: son tres entradas al mismo motor,
que cambia de perfil pero no de loop. Diseñar el MVP para Diego sin romper a
María ni a Ana es un requisito de arquitectura, no un "después vemos".

| | **Diego** — primera oportunidad | **María** — transición laboral | **Ana** — mantenerse al día |
|---|---|---|---|
| **Quién es** | Estudiante universitario boliviano (UAGRM, UPB, UMSA, UCB) o recién egresado | Perdió su empleo; experiencia real, mucha de ella no formal | Profesional activa, sin tiempo para revisar fuentes |
| **Objetivo** | Entrar al mundo profesional | Reinsertarse al mercado laboral | No perder oportunidades de crecimiento |
| **Busca** | Pasantías, primer empleo, becas, hackathons, bootcamps, programas internacionales | Empleos, capacitación, cursos, oportunidades cercanas | Becas, eventos, conferencias, comunidades, convocatorias |
| **Dolor** | No sabe dónde buscar; cree que se está perdiendo algo; "no tengo experiencia" | No domina las plataformas digitales; necesita acompañamiento, no un buscador | Demasiadas fuentes; se entera cuando ya cerraron |
| **Qué le exige al producto** | Que la falta de experiencia no sea un filtro de entrada | Que la experiencia no formal cuente, y que las restricciones se respeten | Que sea **proactivo** — ella no va a entrar a buscar |

**Diego es el del MVP** (es el perfil que más volumen tiene y el que se demuestra
en vivo), pero Ana es la que valida la tesis del producto: si tiene que entrar a
buscar, Oppy no le sirve. Ver [flujo del producto](09-flujo-producto.md).

**Accesibilidad**, transversal a los tres: voz, lectura automática, lenguaje
claro e interfaz simplificada. Beneficia especialmente a personas mayores,
personas con discapacidad visual y usuarios con baja alfabetización digital — que
son barreras de interfaz, no de capacidad.

## Por qué no está resuelto

- Los buscadores de becas existentes (ProFellow, Scholarship.com) están
  centrados en EE.UU./Europa y **no indexan fuentes bolivianas**: embajadas
  en Bolivia, AGCID, Konrad Adenauer Bolivia, fundaciones universitarias,
  portales de empleo locales, aceleradoras nacionales.
- Son **directorios estáticos**, no agentes: listan todo igual para todos y
  no razonan sobre elegibilidad real.
- Nadie asume el problema de la **veracidad**: convocatorias vencidas,
  enlaces muertos, información replicada sin fecha.

## Métricas de éxito

| Métrica | Objetivo MVP | Cómo se mide |
|---------|--------------|--------------|
| Oportunidades relevantes por búsqueda | ≥5 con `compatibilidad` >70 | Salida del agente en la demo |
| Precisión de elegibilidad | ≥80% de los top-5 realmente aplicables al perfil | Revisión manual sobre 3 perfiles de prueba |
| Tiempo de descubrimiento | < 90s vs. horas de búsqueda manual | Cronómetro en la demo |
| Fuentes verificadas | 100% con enlace original y fecha visible | Inspección del dashboard |
| Autonomía real | Cron corriendo sin intervención | Log del scheduled job en Render |

## Alcance

**Dentro (MVP):** descubrimiento y recomendación personalizada de
oportunidades a partir de un perfil, con justificación y señal de confianza, y
el tablero donde la persona las organiza y les da seguimiento.

**Fuera (explícito):** postular por el usuario, gestionar documentos,
construir CV, red social, pagos, cobertura exhaustiva del mercado laboral.

## Restricciones

24h de desarrollo · fuentes públicas únicamente · presupuesto de API
limitado · demo en vivo con red del evento (riesgo real) · contenido y
requisitos en español boliviano.
