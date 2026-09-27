# agenteStellar

Agente de voz para el teléfono. Con una frase entra o sale de Stellar a través de un anchor de demostración en testnet.

El USDC lo emite ese anchor. No es USDC de Circle. El abono bancario es una simulación. El pago en la red es real y queda como comprobante en [Stellar Expert](https://stellar.expert/explorer/testnet).

## Qué usa

| Pieza | Para qué |
| --- | --- |
| Next.js 16 (App Router) y React 19 | Interfaz y rutas del servidor |
| TypeScript | Tipos de punta a punta |
| Tailwind CSS 4 | Estilos y layout móvil |
| anime.js 4 | Orbe de voz, conteo de saldos, entrada del chat y loader |
| Web Speech API | Reconocimiento `es-MX` y lectura de la respuesta |
| `@stellar/stellar-sdk` 17 | Cuentas, SEP-10, trustline, pagos y Horizon |
| Friendbot de testnet | XLM para crear las cuentas |
| Horizon testnet | Envío y lectura de transacciones |
| AI SDK 7 (`ToolLoopAgent`) | Agente de lenguaje, solo si hay clave de AI Gateway |
| Zod 4 | Esquema de las herramientas del modelo |
| [smart-account-kit](https://github.com/stellar/smart-account-kit) 0.8 | Smart wallet con passkey (WebAuthn) en testnet |
| Relayer público de testnet | Paga el fee al desplegar la smart wallet |

El modelo por defecto, si configuras `AI_GATEWAY_API_KEY` o `VERCEL_OIDC_TOKEN`, es `anthropic/claude-sonnet-5`. Se cambia con `GOYA_MODEL`. Sin clave, el agente de protocolo resuelve las órdenes conocidas y no llama a ningún modelo.

## Cómo está construido

```text
Teléfono (voz o texto)
        │
        ▼
components/console.tsx + components/motion.tsx
        │  POST /api/agent
        ▼
Agente de protocolo ──o── Agente de lenguaje (AI Gateway)
        │
        ├─ Red: Friendbot, trustline USDC, pagos en Horizon
        └─ HTTP al anchor local
                ├─ /.well-known/stellar.toml     SEP-1
                ├─ /sep/auth                     SEP-10
                ├─ /sep38/quote                  SEP-38
                ├─ /sep/deposit-exchange         SEP-6
                ├─ /sep/withdraw-exchange        SEP-6
                ├─ /sep/demo/fiat                abono bancario simulado
                └─ /sep/demo/observe             verifica el pago en Horizon
```

Hay dos cuentas de testnet, creadas en esta máquina y guardadas en `.data/state.json` (no se sube a git):

- **Agente.** Cuenta clásica (`G…`). Firma el challenge SEP-10, abre la trustline y, en un retiro, envía el USDC.
- **Anchor.** Publica el `stellar.toml`, cotiza, y emite o quema el USDC.
- **Smart wallet.** Cuenta de contrato (`C…`) que se despliega en la pantalla de inicio de sesión. El firmante es un passkey de este dispositivo, el mismo modelo que [smart-account-kit](https://github.com/stellar/smart-account-kit). El [demo de smart wallet](https://github.com/stellar/smart-wallet-demo-app) de Stellar ya no se mantiene y pide Docker, SDP y un backend aparte; por eso la cuenta nueva usa el kit oficial y no ese monorepo.

El anchor sigue hablando SEP-10 con la cuenta clásica. Una smart wallet se autentica con SEP-45, que este demo todavía no implementa. El USDC de demostración vive en la cuenta del agente. El comprobante de la smart wallet abre el despliegue en Stellar Expert.

Un depósito recorre descubrimiento, autenticación, cotización y SEP-6. El endpoint de demostración marca el USD como recibido y el anchor crea los tokens con un pago desde su cuenta emisora. Un retiro hace el camino inverso: el agente paga al emisor (el activo se quema) y el anchor confirma el hash en Horizon. El mensaje del chat muestra ese hash como comprobante y abre la transacción en Stellar Expert.

## Modelo de negocio

agenteStellar es el cajero de un anchor: una frase reemplaza la web del banco.

| Bloque | Qué es |
| --- | --- |
| Problema | Elegir anchor es opaco, un agente no puede rampear solo y el usuario no ve el protocolo |
| Segmentos | Agentes que necesitan USDC, wallets y fintechs en Latinoamérica, equipos de hackathon |
| Propuesta | Di una frase y entra o sal de Stellar |
| Solución | SEP-1, SEP-10, SEP-38 y SEP-6, por voz o por texto |
| Canales | Voz en el navegador, texto y `stellar.toml` |
| Métricas | USDC en la cuenta, depósitos y retiros completados, comisión cobrada |
| Ventaja | El agente firma solo y deja el hash verificable |
| Costos | Liquidez del anchor, fee de red y, fuera del demo, KYC y banca |
| Ingresos | 1% en cada cotización. En el demo, 25.00 USD entran y salen 24.75 USDC |

El spread del on-ramp y del off-ramp es el negocio del anchor. En este prototipo el fiat no se cobra: sirve para enseñar el flujo. El ingreso visible es esa comisión del 1% aplicada en la cotización.

## Correrlo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La primera orden tarda porque Friendbot crea las dos cuentas y la trustline.

## Qué más puede hacer

Hoy el agente cotiza, deposita, retira y crea la smart wallet. Encima de eso, sin cambiar el negocio del 1 %, caben estas piezas:

- Que el anchor acepte la smart wallet con SEP-45, para que el passkey firme el depósito y el retiro.
- Políticas del propio contrato: límite de gasto y un segundo firmante de recuperación.
- Enviar USDC de demostración a otra cuenta y mostrar ese pago como comprobante.
- KYC del cliente (SEP-12) cuando el fiat deje de ser una simulación.

## Guion de demo

1. En la pantalla de inicio, pulsa «Iniciar sesión». El navegador pide un passkey, despliega la smart wallet y el chat abre con el comprobante.
2. «Fondea 25 USD». El comprobante del mensaje queda en completada y el saldo baja la comisión.
3. Toca el comprobante y ábrelo en Stellar Expert.
4. «Retira 10 USDC». El agente envía el activo al emisor y el anchor verifica el pago.
5. Muestra `/.well-known/stellar.toml` para el descubrimiento del anchor.
