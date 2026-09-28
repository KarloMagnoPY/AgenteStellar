import { PROTOCOLS } from "./market";

export type RoutineGroup = "Revisar" | "Mercado" | "Operar en la demo";

export type CatalogStep = {
  id: string;
  group: RoutineGroup;
  title: string;
  hint: string;
  detail: string;
  message: string;
  needs?: "account" | "contract";
};

export type RoutineItem = {
  uid: string;
  stepId: string;
  input?: string;
};

const review: CatalogStep[] = [
  {
    id: "balance",
    group: "Revisar",
    title: "Mi saldo",
    hint: "USDC y XLM de tu cuenta",
    detail: "USDC y XLM de tu cuenta en testnet.",
    message: "¿Cuál es mi saldo?",
  },
  {
    id: "wallet",
    group: "Revisar",
    title: "Saldo de una wallet",
    hint: "Pega una cuenta G…",
    detail: "Cualquier cuenta G… en testnet.",
    message: "Revisa la wallet {input}",
    needs: "account",
  },
  {
    id: "contract",
    group: "Revisar",
    title: "Revisar un contrato",
    hint: "Pega un contrato C…",
    detail: "Un contrato C… en testnet, sin firmar nada.",
    message: "Revisa el contrato {input}",
    needs: "contract",
  },
];

const market: CatalogStep[] = PROTOCOLS.map((item) => ({
  id: `market-${item.id}`,
  group: "Mercado" as const,
  title: item.name,
  hint: item.figure,
  detail: `${item.role} Solo lectura: no envía la operación.`,
  message: `Analiza ${item.name}`,
}));

const trade: CatalogStep[] = [
  {
    id: "quote",
    group: "Operar en la demo",
    title: "Cotizar 100 USD",
    hint: "Precio en el anchor. No mueve saldo.",
    detail: "Precio real en el anchor. No mueve saldo.",
    message: "Cotiza 100 USD",
  },
  {
    id: "deposit",
    group: "Operar en la demo",
    title: "Fondear 25 USD",
    hint: "Entran USDC de prueba. Comisión 1 %.",
    detail: "Fiat simulado. El USDC que llega a testnet es real, con comisión del 1 %.",
    message: "Fondea 25 USD",
  },
  {
    id: "withdraw",
    group: "Operar en la demo",
    title: "Retirar 10 USDC",
    hint: "Sale USDC hacia fiat simulado.",
    detail: "Saca USDC de prueba hacia el fiat simulado.",
    message: "Retira 10 USDC",
  },
];

export const CATALOG: CatalogStep[] = [...review, ...market, ...trade];

export const GROUPS: RoutineGroup[] = ["Revisar", "Mercado", "Operar en la demo"];

export const GROUP_HINT: Record<RoutineGroup, string> = {
  Revisar: "Mira la red. No firma ni mueve saldo.",
  Mercado: "Cifras del 27 de septiembre de 2026. No envía la operación.",
  "Operar en la demo": "Estas tres sí pasan por el anchor.",
};

export function stepById(id: string) {
  return CATALOG.find((step) => step.id === id) ?? null;
}

export function stepMessage(step: CatalogStep, input?: string) {
  return step.message.replace("{input}", input?.trim() ?? "");
}

const ACCOUNT = /^G[A-Z2-7]{55}$/;
const CONTRACT = /^C[A-Z2-7]{55}$/;

export function inputError(step: CatalogStep, input: string) {
  const value = input.trim().toUpperCase();
  if (step.needs === "account" && !ACCOUNT.test(value)) return "La cuenta tiene que empezar con G y tener 56 caracteres.";
  if (step.needs === "contract" && !CONTRACT.test(value)) return "El contrato tiene que empezar con C y tener 56 caracteres.";
  return "";
}
