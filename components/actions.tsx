export const AGENT_ACTIONS = [
  { id: "balance", kicker: "Mi saldo", label: "¿Cuál es mi saldo?", fill: false, group: "Revisar" },
  { id: "wallet", kicker: "Otra wallet", label: "Revisa la wallet ", fill: true, group: "Revisar" },
  { id: "contract", kicker: "Contrato", label: "Revisa el contrato ", fill: true, group: "Revisar" },
  { id: "market", kicker: "Mercado", label: "Analiza el mercado", fill: false, group: "Revisar" },
  { id: "quote", kicker: "Cotizar", label: "Cotiza 100 USD", fill: false, group: "Operar" },
  { id: "deposit", kicker: "Fondear", label: "Fondea 25 USD", fill: false, group: "Operar" },
  { id: "withdraw", kicker: "Retirar", label: "Retira 10 USDC", fill: false, group: "Operar" },
] as const;

export type AgentAction = (typeof AGENT_ACTIONS)[number];

const chip =
  "shrink-0 rounded-full border border-line bg-paper px-3 py-2 text-xs font-medium text-signal disabled:opacity-40";
const card = "glass rounded-2xl px-3 py-3 text-left disabled:opacity-50";

export function ActionButton({
  action,
  onClick,
  disabled,
  variant,
}: {
  action: AgentAction;
  onClick: () => void;
  disabled?: boolean;
  variant: "chip" | "card";
}) {
  if (variant === "card") {
    return (
      <button type="button" disabled={disabled} onClick={onClick} className={card}>
        <span className="block text-[10px] tracking-wide text-signal uppercase">{action.kicker}</span>
        <span className="mt-1 block text-sm text-foreground">{action.fill ? "Pega la dirección" : action.label}</span>
      </button>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={chip}>
      {action.kicker}
    </button>
  );
}
