import type { EventType } from "@/lib/rules";

export type { EventType };

export interface EventAwardDetail {
  ruleId: string;
  ruleName: string;
  points: number;
}

export interface PostEventResult {
  eventId: string;
  duplicate: boolean;
  totalAwarded: number;
  awards: EventAwardDetail[];
}

export interface PostEventInput {
  eventType: EventType;
  payload: Record<string, unknown>;
  customerId?: string;
  customerEmail?: string;
  eventKey?: string | null;
}
