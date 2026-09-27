import { createHmac, timingSafeEqual } from "crypto";
import { AnchorError } from "./errors";

type JwtPayload = {
  iss: string;
  sub: string;
  iat: number;
  exp: number;
  jti: string;
};

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

export function signJwt(payload: JwtPayload, secret: string) {
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) {
    throw new AnchorError(401, "El JWT de SEP-10 está mal formado.");
  }
  const expected = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    actualBuf.length !== expectedBuf.length ||
    !timingSafeEqual(actualBuf, expectedBuf)
  ) {
    throw new AnchorError(401, "El JWT de SEP-10 no es válido.");
  }
  const payload = JSON.parse(
    Buffer.from(body, "base64url").toString(),
  ) as JwtPayload;
  if (payload.exp * 1000 < Date.now()) {
    throw new AnchorError(401, "El JWT de SEP-10 expiró. Hay que autenticar de nuevo.");
  }
  return payload;
}

export function readJwtExp(token: string) {
  const body = token.split(".")[1];
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as {
    exp: number;
  };
  return payload.exp * 1000;
}
