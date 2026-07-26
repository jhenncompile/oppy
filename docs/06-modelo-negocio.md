# Modelo de negocio

Dos lados, un solo motor. **La persona nunca paga** — si Oppy existe para
cerrar una brecha de acceso, cobrarle a quien está del lado malo de la
brecha contradice el producto. El ingreso viene del otro lado del mercado:
instituciones y empresas que hoy no logran llegar a esa gente.

---

## Parte 1 — La decisión que define la arquitectura

> **¿El índice de oportunidades es compartido entre todos los usuarios, o
> cada usuario dispara su propia búsqueda?**

Es la única decisión de negocio que si se toma mal obliga a reescribir el
backend después.

| | Búsqueda por usuario | **Índice compartido (elegido)** |
|---|---|---|
| Qué hace el click | Dispara Exa + Firecrawl + LLM en vivo | Consulta un índice ya construido y hace matching |
| Costo por búsqueda | $0.10 – $0.50 | ~$0.01 |
| Con 100 usuarios | Inviable, incluso gratis | Sostenible |
| Rol del cron | Extra para el pitch | Corazón del sistema |

El cron es el **productor**: descubre, normaliza y alimenta un índice
global. El matching por usuario es una sola llamada LLM barata sobre
candidatos pre-filtrados. La búsqueda en vivo se conserva como segundo
disparador de la misma tubería, para el efecto de la demo.

Consecuencia clave: **descubrimiento y razonamiento quedan desacoplados**.
Podés reejecutar el matching sin volver a scrapear — y eso es lo que hace
posible todo lo de la Parte 2.

---

## Parte 2 — Qué le vendemos a las empresas

Oppy acumula tres activos que ninguna empresa boliviana tiene: un **índice
vivo y verificado** de oportunidades locales, un **pool de perfiles
motivados** que no están en los portales tradicionales, y un **motor que
razona sobre compatibilidad real**. Sobre eso se construyen cinco productos.

### 1. Publicación verificada — *el más rápido de vender*

La empresa publica su vacante, pasantía o programa directamente en Oppy y
obtiene el sello 🟢 con fuente confirmada y fecha actualizada.

**No compra ranking. Compra existencia y frescura.** En Bolivia el
reclutamiento joven vive en boca a boca y grupos de WhatsApp; una
convocatoria bien publicada igual no llega. Oppy la pone frente a los
perfiles que efectivamente califican.

*Cobro:* por publicación, o suscripción anual con publicaciones ilimitadas.

### 2. Matching inverso — búsqueda de talento

La empresa describe el perfil que necesita y **el mismo motor corre al
revés**: razona sobre los perfiles que dieron consentimiento y devuelve
candidatos con su `por_que_calza`.

Diferencia frente a LinkedIn Recruiter: razona sobre elegibilidad real —
no keywords — y alcanza gente que no tiene un perfil profesional armado.
Justamente el segmento que las empresas dicen "no encontrar".

*Requiere opt-in explícito del usuario.* Es el producto de mayor valor y de
mayor responsabilidad; ver "lo que no se vende".

### 3. Marca empleadora joven

Difusión y medición de programas de pasantías, trainees y becas
corporativas. La empresa recibe un reporte: cuántos jóvenes vieron la
convocatoria, de qué carreras, de qué ciudades, cuántos hicieron clic.

Hoy una empresa que abre un programa de pasantías no tiene forma de saber
si llegó a quien quería llegar. Oppy se lo dice.

### 4. Inteligencia de oportunidades — *el más defendible a largo plazo*

El índice de Oppy es, sin proponérselo, **un censo de lo que el mercado
está pidiendo**: qué habilidades aparecen en las convocatorias, qué carreras
tienen demanda real, qué idiomas se exigen, qué brecha hay entre lo que se
pide y lo que se estudia.

Vendible, agregado y anonimizado, a:
- **Universidades** — diseño curricular con evidencia, no con intuición.
- **Gobiernos y cooperación** — dónde están las brechas de formación.
- **Empresas** — benchmarking de requisitos y compensación.

Nadie más está acumulando ese dato en Bolivia. Cada día que Oppy corre, este
activo crece solo.

### 5. Oppy Impacto (RSE)

Una empresa patrocina el acceso de una población específica — madres
reinsertándose al mercado laboral, personas mayores de 50, personas con
discapacidad — y recibe un reporte de impacto auditable.

Es la vía que conecta la misión social con ingreso real **sin cobrarle
nunca al usuario**. Y es exactamente el caso que motivó el producto.

### 6. API / white-label institucional

Universidades y fundaciones embeben el motor para sus propios estudiantes o
beneficiarios. Modelo B2B2C, licencia anual por institución.

---

## Lo que no se vende, nunca

- **Datos personales identificables.** El matching inverso muestra
  candidatos solo con consentimiento explícito y revocable.
- **Ranking.** El `match_score` responde al perfil de la persona, jamás a
  quién pagó. Una oportunidad patrocinada se marca visualmente y no altera
  su puntaje ni su nivel de confianza.

> El día que un 🟢 se pueda comprar, el semáforo deja de valer — y con él,
> el producto entero.

Esto no es una postura moral decorativa: la confianza *es* la
diferenciación frente a cualquier directorio. Venderla sería vender el
único activo que no se puede copiar rápido.

---

## Consecuencias en el esquema

Todo lo anterior cabe en unos pocos campos. Ponerlos ahora cuesta minutos;
retrofitearlos después cuesta días.

```sql
orgs                    -- empresas, universidades, fundaciones
  id, nombre, tipo ('empresa'|'universidad'|'fundacion'|'gobierno'), plan

users
  id, carrera, nivel_estudios, intereses[], ubicacion, idiomas,
  org_id (nullable),                    -- B2B2C
  visible_para_empresas (bool, false)   -- opt-in del matching inverso

opportunities           -- índice global
  id, titulo, categoria, fuente_nombre, fuente_url,
  fecha_limite, elegibilidad, monto_beneficio, link_aplicacion,
  confianza ('verificada'|'por_validar'|'desactualizada'),
  origen ('descubierta'|'publicada'),   -- publicada = la subió una org
  org_id (nullable), sponsored (bool, false),
  skills[] ,                            -- ← ver nota abajo
  fecha_extraida, estado ('vigente'|'vencida'), hash_dedupe (unique)

matches
  id, user_id, opportunity_id, match_score, por_que_calza,
  estado ('nuevo'|'visto'|'guardado'|'descartado'), created_at

events                  -- impresión, clic, guardado → reportes B2B
  id, user_id, opportunity_id, tipo, created_at

consents
  id, user_id, tipo, otorgado (bool), created_at
```

**Nota sobre `skills[]`:** extraer las habilidades y requisitos como arreglo
estructurado durante la normalización cuesta casi nada hoy — es un campo más
en el prompt que ya estás escribiendo. Sin eso, el producto 4 (inteligencia
de oportunidades) exige reprocesar todo el histórico más adelante. Es la
inversión de mayor retorno de todo el esquema.

**Nota sobre `events`:** sin esta tabla, los productos 3 y 5 no tienen qué
reportar. Es una tabla de tres campos que habilita dos líneas de ingreso.

## Consecuencias en el código

- El servicio de scoring debe recibir `(perfil, oportunidad)` y ser
  simétrico: el matching inverso es el mismo servicio con los roles
  invertidos. Si se escribe acoplado al usuario, el producto 2 exige
  reescribirlo.
- Las oportunidades publicadas por una org entran al índice por la misma
  puerta que las descubiertas — cambia el `origen`, no el pipeline.

## Lo que no hace falta decidir todavía

Precios exactos, planes, pasarela de pago, contratos, estructura legal, plan
de adquisición. Nada de eso toca una línea del MVP.
