import type { FactCard } from "./types";

export const READ_ON = "27 de septiembre de 2026";

export const NO_TRADE =
  "No envié la operación. El USDC de esta cuenta lo emite el anchor de la demo. Estos protocolos liquidan USDC de Circle, o el suyo en testnet.";

export type Protocol = {
  id: string;
  name: string;
  match: string;
  role: string;
  figure: string;
  href: string;
  site: string;
};

export const PROTOCOLS: Protocol[] = [
  {
    id: "blend",
    name: "Blend",
    match: "blend",
    role: "Préstamos en pools V2. El rendimiento no hace un ×100. Una liquidación sí puede borrar el colateral.",
    figure: "$162.3 millones depositados y $43.7 millones prestados",
    href: "https://defillama.com/protocol/blend-pools-v2",
    site: "https://www.blend.capital",
  },
  {
    id: "upshift",
    name: "Upshift",
    match: "upshift",
    role: "Asigna capital on-chain. También está en otras redes.",
    figure: "$30.0 millones en Stellar",
    href: "https://defillama.com/protocol/upshift",
    site: "https://app.upshift.finance",
  },
  {
    id: "defindex",
    name: "DeFindex",
    match: "defindex",
    role: "Vaults de USDC y EURC, de Palta Labs, con API.",
    figure: "$20.3 millones",
    href: "https://defillama.com/protocol/defindex",
    site: "https://www.defindex.io/",
  },
  {
    id: "templar",
    name: "Templar",
    match: "templar",
    role: "Pide USDC contra XLM, CETES, deJAAA, deJTRSY o USTRY.",
    figure: "$13.5 millones depositados y $12.3 millones prestados en Stellar",
    href: "https://docs.templarfi.org/guide/addresses.html",
    site: "https://www.templarfi.org/",
  },
  {
    id: "aquarius",
    name: "Aquarius",
    match: "aquarius",
    role: "Cambio al contado. El swap sigue el precio.",
    figure: "$39.5 millones en DefiLlama. Su web publica $52.79 millones bloqueados, $710.05 millones de volumen y $46.68 mil de recompensas AQUA al mes",
    href: "https://defillama.com/protocol/aquarius-stellar",
    site: "https://aqua.network",
  },
  {
    id: "sdex",
    name: "SDEX",
    match: "sdex",
    role: "Libro de órdenes y AMM nativos de la red.",
    figure: "$16.8 millones en el libro y $9.5 millones en los AMM",
    href: "https://defillama.com/protocol/stellar-dex",
    site: "https://developers.stellar.org/docs/learn/fundamentals/liquidity-on-stellar-sdex-liquidity-pools",
  },
  {
    id: "sushi",
    name: "Sushi",
    match: "sushi",
    role: "Cambio al contado en Stellar.",
    figure: "$15.2 millones",
    href: "https://defillama.com/protocol/sushi-stellar",
    site: "https://sushi.com/",
  },
  {
    id: "soroswap",
    name: "Soroswap",
    match: "soroswap",
    role: "AMM en Soroban y agregador.",
    figure: "$1.24 millones",
    href: "https://defillama.com/protocol/soroswap",
    site: "https://soroswap.finance/",
  },
  {
    id: "phoenix",
    name: "Phoenix",
    match: "phoenix",
    role: "AMM en Soroban. La liquidez medida es pequeña.",
    figure: "$47 mil",
    href: "https://defillama.com/protocol/phoenix-defi-hub",
    site: "https://www.phoenix-hub.io/",
  },
  {
    id: "zenex",
    name: "Zenex",
    match: "zenex",
    role: "Perpetuos en Soroban, precio de Pyth Lazer y liquidación por keepers. La documentación usa 10x: un movimiento del 10 % a favor duplica el margen y uno en contra puede liquidarlo.",
    figure: "DefiLlama no publica su TVL",
    href: "https://docs.zenex.trade/",
    site: "https://docs.zenex.trade/",
  },
  {
    id: "normal",
    name: "Normal",
    match: "normal",
    role: "Derivados listados, sin liquidez medida.",
    figure: "$0 en la ficha de derivados",
    href: "https://defillama.com/protocol/normal",
    site: "https://www.normalfinance.io/",
  },
  {
    id: "moros",
    name: "Moros",
    match: "moros",
    role: "Predicciones. Liquida en USDC de Circle.",
    figure: "DefiLlama no lo lista, así que no hay TVL que citar",
    href: "https://moros.fun",
    site: "https://github.com/HoomanBuilds/moros",
  },
];

export function findProtocol(text: string) {
  return [...PROTOCOLS].sort((a, b) => b.match.length - a.match.length).find((item) => text.includes(item.match));
}

export function marketCard(protocol: Protocol): FactCard {
  return {
    title: protocol.name,
    rows: [
      { label: "Dato", value: protocol.figure },
      { label: "Leído", value: READ_ON },
      { label: "Ficha", value: "Abrir", href: protocol.href },
      { label: "Sitio", value: "Abrir", href: protocol.site },
    ],
  };
}

export function marketReply(protocol: Protocol) {
  return `${protocol.name}: ${protocol.role} ${protocol.figure}. Cifra del ${READ_ON}. ${NO_TRADE}`;
}

export function marketIndexCard(): FactCard {
  return {
    title: "Mercado en Stellar",
    rows: PROTOCOLS.map((item) => ({
      label: item.name,
      value: item.figure,
      href: item.href,
    })),
  };
}

export function marketIndexReply() {
  return `Estas son las mesas que puedo leer, no operar con el USDC de esta demo. ${NO_TRADE}`;
}
