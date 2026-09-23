export function databaseUrl(): string {
  const host = process.env.POSTGRES_HOST ?? "127.0.0.1";
  const port = process.env.POSTGRES_PORT ?? "5432";
  const dbName = process.env.POSTGRES_DB ?? "loyalty";
  const user = process.env.POSTGRES_USER ?? "loyalty";
  const password = process.env.POSTGRES_PASSWORD ?? "";
  if (!password) {
    throw new Error("POSTGRES_PASSWORD is required");
  }
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
    password,
  )}@${host}:${port}/${dbName}`;
}