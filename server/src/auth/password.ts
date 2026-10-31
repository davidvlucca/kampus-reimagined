import { randomBytes } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

// argon2id com os parâmetros mínimos recomendados pela OWASP (19 MiB, 2 iterações, 1 thread).
// hash-wasm é argon2 em WebAssembly: corre igual em qualquer máquina, sem binários nativos
// (importante para o bundle da Vercel). O resultado é a string PHC normal ($argon2id$...).
const PARAMS = { parallelism: 1, iterations: 2, memorySize: 19_456, hashLength: 32 } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2id({ ...PARAMS, password, salt: randomBytes(16), outputType: "encoded" });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash: passwordHash });
  } catch {
    return false;
  }
}

// Hash de uma password que ninguém sabe. Quando o email não existe, verificamos
// contra este hash para a resposta demorar o mesmo tempo que uma password errada
// (assim o tempo de resposta não revela que emails têm conta).
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("kampus-dummy-password-never-used");
  await verifyPassword(await dummyHash, password);
}
