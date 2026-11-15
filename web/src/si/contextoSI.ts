import type { ContextoSI } from "./verificadorSI";

export function sugerenciasSI(ctx: ContextoSI, idioma: "en" | "es"): string[] {
  const es = idioma === "es";
  const id = ctx.ficha?.id;
  const ficha: [string, string][] = [
    [id ? `What supports the result for ${id}, and what evidence is missing?` : "What does a site record tell us?",
      id ? `¿Qué respalda el resultado de ${id} y qué evidencia falta?` : "¿Qué nos dice la ficha de un sitio?"],
    ["What should the field team measure first?", "¿Qué debería medir primero el equipo de campo?"],
  ];
  const porPagina: Record<string, [string, string][]> = {
    home: [["How can the SI help me choose a rehearsal site?", "¿Cómo me ayuda la SI a elegir un sitio de ensayo?"],
      ["What evidence supports the published ranking?", "¿Qué evidencia respalda el ranking publicado?"]],
    explore: [["How should I compare compatibility and evidence?", "¿Cómo comparo compatibilidad y evidencia?"],
      ["Why are reference controls separate from field sites?", "¿Por qué se separan los controles de los sitios de campo?"]],
    card: ficha, ficha,
    guide: [["How should I interpret the shadow measurement?", "¿Cómo interpreto la medición de sombra?"],
      ["Which assumptions does the field measurement use?", "¿Qué supuestos usa la medición de campo?"]],
    field: [["What should I measure first in the field?", "¿Qué debería medir primero en campo?"],
      ["Which conditions cannot be reproduced on Earth?", "¿Qué condiciones no se pueden reproducir en la Tierra?"]],
    learn: [["How are compatibility and evidence different?", "¿En qué se diferencian compatibilidad y evidencia?"],
      ["How do I interpret the model bounds?", "¿Cómo interpreto los límites del modelo?"]],
    checks: [["Where do these data come from, and how are they verified?", "¿De dónde salen estos datos y cómo se verifican?"],
      ["What does a file hash prove?", "¿Qué demuestra la huella de un archivo?"]],
    data: [["Which sources support this result?", "¿Qué fuentes respaldan este resultado?"],
      ["How can I reproduce the verification?", "¿Cómo puedo repetir la verificación?"]],
    lab: [["How are geometric night, darkness and battery risk different?", "¿En qué se diferencian noche geométrica, oscuridad y riesgo de batería?"],
      ["Which inputs does the engine need to analyze this point?", "¿Qué datos necesita el motor para analizar este punto?"]],
    compare: [["How should I interpret this comparison?", "¿Cómo interpreto esta comparación?"],
      ["Which evidence is missing from these results?", "¿Qué evidencia falta en estos resultados?"]],
    worlds: [["Which shadow conditions transfer between Earth and Moon?", "¿Qué condiciones de sombra se reproducen entre la Tierra y la Luna?"],
      ["Which assumptions affect this experiment?", "¿Qué supuestos afectan este experimento?"]],
  };
  return (porPagina[ctx.pagina] ?? ficha).map(s => s[es ? 1 : 0]);
}

export function bienvenidaSI(ctx: ContextoSI, idioma: "en" | "es", tienePedido: boolean): string {
  const es = idioma === "es";
  const partes = [es ? "Te explico esta pantalla con los datos publicados disponibles." : "I explain this screen using the available published data."];
  if (ctx.ficha) partes.push(es ? `Tengo la ficha de ${ctx.ficha.id}, su evidencia y sus límites.` : `I have the ${ctx.ficha.id} record, its evidence and its limits.`);
  else partes.push(es ? "No hay una ficha cargada en este contexto." : "No site record is loaded in this context.");
  if (ctx.ranking?.length) partes.push(es ? "También tengo el ranking publicado." : "I also have the published ranking.");
  if (ctx.manifest) partes.push(es ? "El manifiesto de fuentes está disponible." : "The source manifest is available.");
  if (tienePedido) partes.push(es ? "Podés ejecutar el motor con los parámetros de esta pantalla." : "You can run the engine with this screen's parameters.");
  else if (ctx.pagina === "lab") partes.push(es ? "Usá «Explicar con SI» desde el punto del laboratorio para traer sus parámetros." : "Use Explain with SI from a laboratory point to supply its parameters.");
  return partes.join(" ");
}
