/**
 * Recorre una lista con un tope de tareas simultaneas.
 *
 * El agente dispara decenas de llamadas al modelo y a las APIs externas; sin
 * tope, una corrida grande satura el proveedor y termina siendo mas lenta que
 * si se hubiera limitado.
 *
 * Preserva el orden de entrada y nunca rechaza: los fallos vuelven como
 * `{ ok: false, error }` para que quien llama decida.
 */
export async function mapConLimite(items, limite, tarea) {
  const resultados = new Array(items.length);
  let siguiente = 0;

  const trabajador = async () => {
    while (siguiente < items.length) {
      const indice = siguiente++;
      try {
        resultados[indice] = { ok: true, valor: await tarea(items[indice], indice) };
      } catch (error) {
        resultados[indice] = { ok: false, error };
      }
    }
  };

  const trabajadores = Array.from(
    { length: Math.min(limite, items.length) },
    trabajador
  );

  await Promise.all(trabajadores);
  return resultados;
}

/** Azucar para el caso comun: descartar fallos y quedarse con los valores. */
export async function mapExitosos(items, limite, tarea) {
  const resultados = await mapConLimite(items, limite, tarea);
  return resultados.filter((r) => r.ok).map((r) => r.valor);
}
