import { stepCountIs, tool, ToolLoopAgent } from "ai";
import { z } from "zod";
import { hasLanguageModel } from "./agent/language";
import { runProtocol } from "./agent/protocol";
import { fromCents, toCents } from "./money";
import { getState, updateState, type LifeDesk, type LifeLog, type LifeRecord } from "./store";

export const LIFE_START = "5.00";
export const LIFE_TARGET = "500.00";
const METABOLISM = 5;
const MODEL = process.env.GOYA_MODEL || "anthropic/claude-sonnet-5";

export const DESKS: Record<Exclude<LifeDesk, "anchor">, { label: string; rule: string }> = {
  trading: {
    label: "Trading",
    rule: "Simulacro. 45% pierde la puesta, 35% gana la mitad, 15% la triplica, 5% paga ×8.",
  },
  lending: {
    label: "Lending",
    rule: "Simulacro. 8% de interés sobre la puesta, o un default que la borra.",
  },
  perps: {
    label: "Perpetuos",
    rule: "Simulacro apalancado. Gana o pierde el doble de la puesta.",
  },
  predicciones: {
    label: "Predicciones",
    rule: "Simulacro binario. Pierde la puesta o la duplica.",
  },
};

export type LifeView = {
  balance: string;
  start: string;
  target: string;
  multiple: string;
  status: LifeRecord["status"];
  cycles: number;
  motor: "lenguaje" | "politica";
  log: LifeLog[];
  desks: Array<{ id: LifeDesk; label: string; rule: string; live: boolean }>;
};

const choiceSchema = z.object({
  desk: z.enum(["trading", "lending", "perps", "predicciones", "anchor"]),
  note: z.string(),
});

function publicLife(life: LifeRecord, motor: LifeView["motor"]): LifeView {
  const multiple = (toCents(life.balance) / toCents(LIFE_START)).toFixed(2);
  return {
    balance: life.balance,
    start: LIFE_START,
    target: LIFE_TARGET,
    multiple,
    status: life.status,
    cycles: life.cycles,
    motor,
    log: life.log.slice(0, 8),
    desks: [
      { id: "anchor", label: "Anchor", rule: "En vivo. SEP-38. La comisión del 1% no multiplica la vida.", live: true },
      ...Object.entries(DESKS).map(([id, desk]) => ({
        id: id as LifeDesk,
        label: desk.label,
        rule: desk.rule,
        live: false,
      })),
    ],
  };
}

export async function lifeView(): Promise<LifeView> {
  const state = await getState();
  return publicLife(state.life, hasLanguageModel() ? "lenguaje" : "politica");
}

function roll(seed: number) {
  return Math.abs(Math.imul(seed + 1, 1664525) + 1013904223) % 100;
}

function simulate(desk: Exclude<LifeDesk, "anchor">, balanceCents: number, cycle: number) {
  const stake = Math.max(10, Math.floor(balanceCents / 4));
  const bounded = Math.min(stake, balanceCents);
  const ticket = roll(cycle + desk.length * 17);
  let pnl = 0;
  let detail = "";
  if (desk === "trading") {
    if (ticket < 45) pnl = -bounded;
    else if (ticket < 80) pnl = Math.floor(bounded / 2);
    else if (ticket < 95) pnl = bounded * 2;
    else pnl = bounded * 8;
    detail = `${DESKS.trading.label}. Puesta ${fromCents(bounded)}. Sorteo ${ticket}.`;
  } else if (desk === "lending") {
    pnl = ticket < 12 ? -bounded : Math.max(1, Math.floor(bounded * 0.08));
    detail = `${DESKS.lending.label}. Puesta ${fromCents(bounded)}. Sorteo ${ticket}.`;
  } else if (desk === "perps") {
    pnl = ticket < 50 ? -bounded * 2 : bounded * 2;
    detail = `${DESKS.perps.label}. Puesta ${fromCents(bounded)}. Sorteo ${ticket}.`;
  } else {
    pnl = ticket < 55 ? -bounded : bounded;
    detail = `${DESKS.predicciones.label}. Puesta ${fromCents(bounded)}. Sorteo ${ticket}.`;
  }
  return { stake: fromCents(bounded), pnlCents: pnl, detail: `${detail} ${DESKS[desk].rule}` };
}

function policy(balance: string): z.infer<typeof choiceSchema> {
  const cents = toCents(balance);
  if (cents < 150) {
    return { desk: "lending", note: "La vida está baja. Busco el yield chico para no morir." };
  }
  if (cents > 20_000) {
    return { desk: "predicciones", note: "Ya voy lejos. Protejo el camino al ×100." };
  }
  return { desk: "trading", note: "La meta es ×100. Hace falta la cola gorda del trading." };
}

async function choose(balance: string, cycles: number): Promise<z.infer<typeof choiceSchema>> {
  const fallback = policy(balance);
  if (!hasLanguageModel()) return fallback;
  try {
    const agent = new ToolLoopAgent({
      model: MODEL,
      stopWhen: stepCountIs(3),
      instructions: [
        "Eres la vida de agenteStellar. Naces con 5.00 y mueres en 0. La meta es 500.00, un ×100.",
        "Cada ciclo cobra 0.05 de metabolismo.",
        "El anchor es real y solo cotiza: no hace crecer la vida.",
        "Trading, lending, perpetuos y predicciones son un simulacro con las reglas que te da la herramienta. No inventes otro resultado.",
        "Elige una sola mesa. Habla en español, una frase.",
      ].join(" "),
      tools: {
        decidir: tool({
          description: "Elige la mesa de este ciclo.",
          inputSchema: choiceSchema,
          execute: async (input) => input,
        }),
      },
    });
    const result = await agent.generate({
      prompt: `Vida ${balance} de ${LIFE_TARGET}. Ciclo ${cycles}. ${fallback.note}`,
    });
    const called = result.steps
      ?.flatMap((step) => step.toolResults ?? [])
      .map((item) => item.output)
      .find((output) => choiceSchema.safeParse(output).success);
    const parsed = choiceSchema.safeParse(called);
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

function commit(input: { desk: LifeDesk; detail: string; stake: string; pnlCents: number }): Promise<LifeView> {
  return updateState((state) => {
    const life = state.life;
    if (life.status !== "alive") return publicLife(life, hasLanguageModel() ? "lenguaje" : "politica");
    const nextCents = Math.max(0, toCents(life.balance) - METABOLISM + input.pnlCents);
    life.balance = fromCents(nextCents);
    life.cycles += 1;
    life.status = nextCents <= 0 ? "dead" : nextCents >= toCents(LIFE_TARGET) ? "ascended" : "alive";
    const entry: LifeLog = {
      at: new Date().toISOString(),
      desk: input.desk,
      detail: input.detail,
      stake: input.stake,
      pnl: fromCents(input.pnlCents - METABOLISM),
      balance: life.balance,
    };
    life.log = [entry, ...life.log].slice(0, 12);
    return publicLife(life, hasLanguageModel() ? "lenguaje" : "politica");
  });
}

export async function runCycle(origin: string): Promise<LifeView> {
  const state = await getState();
  if (state.life.status !== "alive") return lifeView();
  const decision = await choose(state.life.balance, state.life.cycles);
  if (decision.desk === "anchor") {
    const quote = await runProtocol(origin, "Cotiza 5 USD");
    return commit({
      desk: "anchor",
      stake: "0.00",
      pnlCents: 0,
      detail: `${decision.note} ${quote.reply}`,
    });
  }
  const sim = simulate(decision.desk, toCents(state.life.balance), state.life.cycles);
  return commit({
    desk: decision.desk,
    stake: sim.stake,
    pnlCents: sim.pnlCents,
    detail: `${decision.note} ${sim.detail}`,
  });
}

export async function reincarnate(): Promise<LifeView> {
  return updateState((state) => {
    state.life = {
      balance: LIFE_START,
      status: "alive",
      bornAt: new Date().toISOString(),
      cycles: 0,
      log: [],
    };
    return publicLife(state.life, hasLanguageModel() ? "lenguaje" : "politica");
  });
}
