# Goya

Agente de voz para un hackathon. El producto está contado como un Lean Canvas: problema, segmentos, propuesta, solución, canales, métricas, ventaja, costos e ingresos.

Entra y sale de Stellar por un anchor de demostración en testnet. Puedes hablarle o escribirle.

El usuario escribe una orden. El agente descubre el `stellar.toml` (SEP-1), firma el challenge (SEP-10), pide una cotización en firme (SEP-38) y abre un depósito o retiro (SEP-6). El USDC lo emite el propio anchor: es un activo de prueba, no USDC de Circle. El abono bancario es simulado. El pago en Stellar es real y se puede abrir en Stellar Expert.

Sin clave de modelo, Goya usa un agente de protocolo que entiende órdenes como «Fondea 25 USD». Con `AI_GATEWAY_API_KEY` o `VERCEL_OIDC_TOKEN`, las frases que no reconoce pasan por un modelo (`GOYA_MODEL`, por defecto `anthropic/claude-sonnet-5`).

## Correrlo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La primera orden tarda porque Friendbot crea la cuenta del agente y la del anchor, y se abre la trustline.

Las claves quedan en `.data/state.json`. Son de testnet y no se suben al repositorio.

## Guion de demo

1. «Fondea 25 USD». El recibo debe quedar en `completed` y el saldo cerca de 24.75 USDC.
2. Abre la transacción en Stellar Expert.
3. «Retira 10 USDC». El agente envía el activo al emisor y el anchor lo verifica en Horizon.
4. Muestra `/.well-known/stellar.toml` para enseñar el descubrimiento del anchor.
