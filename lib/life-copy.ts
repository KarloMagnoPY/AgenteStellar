type Desk = "trading" | "lending" | "perps" | "predicciones" | "anchor";

const DESK_NAME: Record<Desk, string> = {
  anchor: "el anchor",
  trading: "trading",
  lending: "préstamo",
  perps: "perpetuos",
  predicciones: "predicciones",
};

export function daySentence(entry: { desk: Desk; stake: string; pnl: string; balance: string }): string {
  const net = entry.pnl.startsWith("-") ? entry.pnl : `+${entry.pnl}`;
  if (entry.desk === "anchor") {
    return `Cotizó en el anchor. El día cerró en ${net}: es el costo de seguir vivo. Quedan ${entry.balance}.`;
  }
  return `Arriesgó ${entry.stake} en ${DESK_NAME[entry.desk]}. El día cerró en ${net}, ya cobrado el 0.05 de seguir vivo. Quedan ${entry.balance}.`;
}
