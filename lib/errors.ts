export class AnchorError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function explainHorizon(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const data = (
      error as {
        response?: {
          data?: { extras?: { result_codes?: unknown }; detail?: string };
        };
      }
    ).response?.data;
    if (data?.extras?.result_codes) {
      return `Stellar rechazó la transacción: ${JSON.stringify(data.extras.result_codes)}`;
    }
    if (data?.detail) return data.detail;
  }
  if (error instanceof Error) return error.message;
  return "error de red Stellar";
}
