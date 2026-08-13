import { client } from "./client";

export async function seedDemoData(): Promise<void> {
  await client.post("/seed");
}
