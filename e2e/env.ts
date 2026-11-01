// Portas e segredo só dos testes E2E (diferentes dos prints e da demo).
export const E2E_PORTS = { api: 3201, web: 4274 };
// Pelo menos 32 caracteres: com menos, a API não liga a rota de reposição.
export const E2E_CRON_SECRET = "e2e-only-not-a-secret-but-32-chars-long";
