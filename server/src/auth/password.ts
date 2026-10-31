import { hash, verify } from "@node-rs/argon2";

// argon2id com os parâmetros por omissão da biblioteca (recomendados pela OWASP).
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
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
