import { AnchorError } from "./errors";

export function toCents(amount: string): number {
  const [whole, frac = ""] = amount.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

export function fromCents(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function parseAmount(input: string): number {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new AnchorError(
      400,
      "El monto debe ser un número con hasta 2 decimales.",
    );
  }
  const cents = toCents(normalized);
  if (cents < 100 || cents > 100_000) {
    throw new AnchorError(400, "El monto debe estar entre 1.00 y 1000.00.");
  }
  return cents;
}

export function totalPrice(sellCents: number, buyCents: number): string {
  return (sellCents / buyCents).toFixed(7);
}

export function sameAmount(a: string, b: string): boolean {
  return toCents(a) === toCents(b);
}
