import { client } from "./client";
import type { PostEventInput, PostEventResult } from "@/types";

export async function postEvent(input: PostEventInput): Promise<PostEventResult> {
  const { data } = await client.post<PostEventResult>("/events", input);
  return data;
}
