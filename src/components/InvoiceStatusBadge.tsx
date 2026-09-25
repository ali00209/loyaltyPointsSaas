import { Badge } from "@astryxdesign/core/Badge";
import type { InvoiceEffectiveStatus } from "@/types";

const CONFIG: Record<
  InvoiceEffectiveStatus,
  { variant: "green" | "red" | "yellow" | "blue" | "neutral"; label: string }
> = {
  paid: { variant: "green", label: "Paid" },
  partially_paid: { variant: "yellow", label: "Partially paid" },
  overdue: { variant: "red", label: "Overdue" },
  issued: { variant: "blue", label: "Due" },
  draft: { variant: "neutral", label: "Draft" },
  voided: { variant: "neutral", label: "Voided" },
};

export function InvoiceStatusBadge({
  status,
}: {
  status: InvoiceEffectiveStatus;
}) {
  const config = CONFIG[status] ?? CONFIG.draft;
  return <Badge variant={config.variant} label={config.label} />;
}