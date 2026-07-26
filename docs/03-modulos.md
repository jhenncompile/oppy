# Fase 3 — Módulos

Descomposición del loop del agente en piezas construibles y asignables.
`MVP` = se construye en las 24h. `Bonus` = solo si el núcleo ya corre.
`Roadmap` = se menciona en el pitch, no se construye.

## Catálogo

| ID | Módulo | Responsabilidad | Depende de | Estado |
|----|--------|-----------------|------------|--------|
| M1 | **Perfil** | Capturar y persistir carrera, nivel, intereses, ubicación, idiomas | — | MVP |
| M2 | **Orquestador** | Decidir fuentes y generar queries dinámicas según el perfil | M1 | MVP |
| M3 | **Explorador** | Búsqueda semántica + scraping estructurado + fuentes fijas, en paralelo | M2 | MVP |
| M4 | **Normalizador** | Mapear resultados crudos al esquema común, deduplicar | M3 | MVP |
| M5 | **Analista / Scoring** | Razonar elegibilidad, producir `compatibilidad`, `razones[]` y `brechas[]` | M4, M1 | MVP |
| M6 | **Confianza** | Clasificar fuente (🟢🟡🔴), validar enlace y frescura | M4 | MVP |
| M7 | **Dashboard** | Listar priorizado, detalle, estado de proceso en vivo | M5, M6 | MVP |
| M8 | **Scheduler** | Correr el pipeline por cron para usuarios demo | M2–M6 | MVP |
| M9 | **Voz** | Onboarding hablado y resumen en audio | M1, M7 | Bonus |
| M10 | **Acompañante** | Alertas de deadline, next steps, sugerencia de curso | M5, M8 | Bonus (solo deadline) |
| M11 | **Aprendizaje** | Guardar/descartar ajusta recomendaciones futuras | M5 | Roadmap |
| M12 | **Entrega externa** | WhatsApp / email | M7, M8 | Roadmap |

## Grafo de dependencias

```
M1 Perfil
  └─> M2 Orquestador
        └─> M3 Explorador
              └─> M4 Normalizador
                    ├─> M5 Analista ──┐
                    └─> M6 Confianza ─┴─> M7 Dashboard
                                            ▲
M8 Scheduler ──(reejecuta M2..M6)───────────┘
```

Sin ciclos. M8 no es una capa aparte: dispara el mismo pipeline que el botón
del dashboard. **Un solo camino de código, dos disparadores** — así el cron
no puede divergir de lo que se demuestra en vivo.

## Contrato central: esquema de oportunidad

Este objeto es la frontera entre M4/M5/M6 y M7. Se congela **antes** del
evento para que frontend y backend avancen en paralelo sin bloquearse.

```json
{
  "id": "uuid",
  "titulo": "string",
  "categoria": "beca | pasantia | empleo | intercambio | concurso | financiamiento",
  "fuente": { "nombre": "string", "url": "string" },
  "fecha_limite": "ISO date | null",
  "elegibilidad": "string (resumen del LLM)",
  "monto_beneficio": "string | null",
  "compatibilidad": 0,
  "razones": ["string (generado por LLM)"],
  "brechas": ["string (lo que le falta para postular)"],
  "confianza": "verificada | por_validar | desactualizada",
  "link_aplicacion": "url",
  "fecha_extraida": "ISO date"
}
```

Perfil de usuario:

```json
{
  "id": "uuid",
  "carrera": "string",
  "nivel_estudios": "string",
  "intereses": ["string"],
  "ubicacion": "string",
  "idiomas": [{ "idioma": "string", "nivel": "string" }]
}
```

## Fuentes (M3) — validar antes del evento

Probar a mano cada una y quedarse con las 3–5 más estables:

- Embajadas en Bolivia (EE.UU., España, Francia, Alemania, Japón)
- AGCID · Fundación Konrad Adenauer Bolivia
- Portales de becas de UAGRM, UPB, UCB, UMSA
- Bumeran Bolivia · Computrabajo Bolivia
- Aceleradoras locales (INCUBATEC, ACELERATEC)

Regla: al menos **dos fuentes de estructura muy estable** funcionando como
red de seguridad para la demo en vivo.

## Orden de construcción

1. **Esqueleto vertical**: perfil falso → 1 fuente → LLM → 1 card en
   pantalla. Fin a fin lo antes posible, aunque sea feo.
2. Ampliar el Explorador a las demás fuentes.
3. Normalizador + dedupe.
4. Scoring con `razones[]` y `brechas[]`.
5. Confianza.
6. Dashboard real con el diseño de la fase 4.
7. Cron.
8. Bonus (voz, audio).

Nunca construir un módulo "completo" antes de que exista el camino
vertical: si a la hora 20 el pipeline no conecta de punta a punta, no hay
demo.

## Reparto sugerido (equipo de 2–3)

| Persona | Módulos |
|---------|---------|
| A — backend/agente | M2, M3, M4, M5, M8 |
| B — frontend | M1 (UI), M7, integración del contrato |
| C — si existe | M6, M9, datos de fuentes, guion y ensayo del pitch |
