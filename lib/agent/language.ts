import { stepCountIs, tool, ToolLoopAgent } from "ai";
import { z } from "zod";
import { runProtocol } from "./protocol";
import type { LifeView } from "../life";
import type { AgentResponse, PublicTransaction, Step } from "../types";
import { walletView } from "../wallet";

const MODEL = process.env.GOYA_MODEL || "anthropic/claude-sonnet-5";

export function hasLanguageModel() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN,
  );
}

export async function runLanguage(
  origin: string,
  message: string,
): Promise<AgentResponse> {
  const steps: Step[] = [];
  let transaction: PublicTransaction | null = null;
  let life: LifeView | undefined;

  const absorb = (result: AgentResponse) => {
    steps.push(...result.steps);
    if (result.transaction) transaction = result.transaction;
    return {
      reply: result.reply,
      transaction: result.transaction,
      usdc: result.wallet.usdc,
    };
  };

  const agent = new ToolLoopAgent({
    model: MODEL,
    stopWhen: stepCountIs(6),
    instructions: [
      "Eres agenteStellar, un agente que entra y sale de Stellar usando un anchor de demostración.",
      "Habla en español, breve y concreto.",
      "Usa las herramientas para saldo, cotización, depósito, retiro, vida, ciclo e historial. No inventes hashes, montos ni saldos.",
      "Un ciclo de vida cobra 0.05 y arriesga cerca de un cuarto del saldo en una sola mesa. La meta es 500. En 0 muere.",
      "El anchor es real. Trading, lending, perpetuos y predicciones de la pantalla Vida son un simulacro con reglas públicas.",
      "El abono bancario es simulado. SEP-10, SEP-38 y el USDC en testnet son reales.",
      "USDC aquí lo emite el anchor de prueba: no es USDC de Circle.",
      "Si la herramienta devuelve un error, explícalo y no simules éxito.",
    ].join(" "),
    tools: {
      saldo: tool({
        description: "Lee el saldo XLM y USDC de demostración del agente en testnet.",
        inputSchema: z.object({}),
        execute: async () => absorb(await runProtocol(origin, "¿Cuál es mi saldo?")),
      }),
      cotizar: tool({
        description: "Pide una cotización SEP-38. direction deposit cambia USD a USDC; withdraw cambia USDC a USD.",
        inputSchema: z.object({
          amount: z.string().describe("Monto con hasta 2 decimales, entre 1 y 1000."),
          direction: z.enum(["deposit", "withdraw"]),
        }),
        execute: async ({ amount, direction }) =>
          absorb(
            await runProtocol(
              origin,
              direction === "deposit"
                ? `Cotiza ${amount} USD`
                : `Cotiza ${amount} USDC a USD`,
            ),
          ),
      }),
      fondear: tool({
        description: "Deposita USD de demostración y recibe USDC emitido en testnet.",
        inputSchema: z.object({
          amount: z.string().describe("USD a depositar, entre 1 y 1000."),
        }),
        execute: async ({ amount }) =>
          absorb(await runProtocol(origin, `Fondea ${amount} USD`)),
      }),
      retirar: tool({
        description: "Envía USDC al anchor y marca el USD de demostración como pagado.",
        inputSchema: z.object({
          amount: z.string().describe("USDC a retirar, entre 1 y 1000."),
        }),
        execute: async ({ amount }) =>
          absorb(await runProtocol(origin, `Retira ${amount} USDC`)),
      }),
      vida: tool({
        description: "Lee la vida del agente: saldo, día, meta y estado.",
        inputSchema: z.object({}),
        execute: async () => {
          const { answerAside } = await import("./aside");
          const result = await answerAside(origin, "life");
          life = result.life;
          return { reply: result.reply };
        },
      }),
      vivir: tool({
        description: "Vive un día: cobra 0.05 y opera una sola mesa.",
        inputSchema: z.object({}),
        execute: async () => {
          const { answerAside } = await import("./aside");
          const result = await answerAside(origin, "cycle");
          life = result.life;
          return { reply: result.reply };
        },
      }),
      historial: tool({
        description: "Lista los últimos depósitos y retiros del anchor.",
        inputSchema: z.object({}),
        execute: async () => {
          const { answerAside } = await import("./aside");
          const result = await answerAside(origin, "history");
          return { reply: result.reply };
        },
      }),
    },
  });

  const result = await agent.generate({ prompt: message });
  return {
    mode: "language",
    reply: result.text || "No obtuve una respuesta del modelo.",
    steps,
    transaction,
    wallet: await walletView(),
    life,
  };
}
