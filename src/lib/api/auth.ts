import type { LoginInput, RegisterInput, User } from "@/types";
import { client } from "./client";

export async function login(input: LoginInput): Promise<User> {
  const { data } = await client.post<{ user: User }>("/auth/login", input);
  return data.user;
}

export async function register(input: RegisterInput): Promise<User> {
  const { data } = await client.post<{ user: User }>("/auth/register", input);
  return data.user;
}

export async function logout(): Promise<void> {
  await client.post("/auth/logout");
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await client.get<{ user: User }>("/auth/me");
  return data.user;
}
