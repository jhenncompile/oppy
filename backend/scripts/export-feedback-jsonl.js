#!/usr/bin/env node
/**
 * Exporta senales de usuario (matches guardados/descartados) a JSONL
 * para reentrenar / retroalimentar el LoRA de Oppy.
 *
 * Uso:
 *   cd backend && node scripts/export-feedback-jsonl.js > ../../oppy-datasets/feedback/matches.jsonl
 */
import { writeFileSync } from 'node:fs';
import { query, closePool } from '../src/db/index.js';

const outPath = process.argv[2] || null;

const { rows } = await query(
  `SELECT m.estado, m.tipo_feedback, m.comentario_feedback, m.compatibilidad,
          m.razones, m.brechas, m.elegible, m.updated_at,
          u.carrera, u.habilidades, u.objetivos, u.ubicacion, u.nivel_estudios,
          o.titulo, o.categoria, o.skills, o.elegibilidad, o.descripcion
   FROM matches m
   JOIN users u ON u.id = m.user_id
   JOIN opportunities o ON o.id = m.opportunity_id
   WHERE m.estado IN (
     'guardado', 'preparando', 'aplicada', 'entrevista',
     'finalizada', 'descartado'
   )
   ORDER BY m.updated_at DESC
   LIMIT 5000`
);

const lineas = rows.map((row) => {
  const esMalaInfo = row.estado === 'descartado' && row.tipo_feedback === 'mala_info';
  const label =
    row.estado === 'descartado'
      ? {
          match: 'bajo',
          score: Math.min(30, row.compatibilidad),
          reason: esMalaInfo
            ? (row.comentario_feedback || 'Usuario: información incorrecta')
            : 'Usuario descartó (no me interesa)'
        }
      : {
          match: row.compatibilidad >= 70 ? 'alto' : 'medio',
          score: row.compatibilidad,
          reason: (row.razones && row.razones[0]) || `Estado ${row.estado}`
        };

  return JSON.stringify({
    task: 'matching',
    instruction:
      'Evalúa la compatibilidad entre el usuario y la oportunidad. Responde solo con JSON válido.',
    input: {
      user: {
        career: row.carrera,
        skills: row.habilidades,
        interests: row.objetivos,
        location: row.ubicacion,
        level: row.nivel_estudios
      },
      opportunity: {
        type: row.categoria,
        title: row.titulo,
        skills: row.skills,
        requirements: row.elegibilidad ? [row.elegibilidad] : [],
        description: row.descripcion
      },
      user_feedback_estado: row.estado,
      user_feedback_tipo: row.tipo_feedback,
      user_feedback_comentario: row.comentario_feedback
    },
    output: label,
    meta: { source: 'oppy_user_feedback', updated_at: row.updated_at }
  });
});

const texto = `${lineas.join('\n')}${lineas.length ? '\n' : ''}`;
if (outPath) {
  writeFileSync(outPath, texto);
  console.error(`Escritas ${lineas.length} filas → ${outPath}`);
} else {
  process.stdout.write(texto);
}

await closePool();
