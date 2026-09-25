"use client";

import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import { useBillingPlans, useRequestSubscription, useSubscription } from "@/lib/query";
import { formatPKR } from "@/lib/money";
import type { BillingCycle } from "@/types";

function cycleWord(cycle: BillingCycle): string {
  return cycle === "weekly" ? "per week" : "per month";
}

export default function AppBillingSetting() {
  const toast = useToast();
  const { data: plans = [], isLoading: plansLoading } = useBillingPlans();
  const { data: sub, isLoading: subLoading } = useSubscription();
  const request = useRequestSubscription();

  if (plansLoading || subLoading) {
    return <AppLoading label="Loading billing..." />;
  }

  const handleSelect = async (planId: string) => {
    try {
      await request.mutateAsync({ planId });
      toast({ type: "info", body: "Plan requested. Awaiting admin approval." });
    } catch (err) {
      toast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to request plan",
      });
    }
  };

  const pending =
    sub?.status === "pending"
      ? sub
      : undefined;
  const active = sub?.status === "active" ? sub : undefined;

  return (
    <VStack gap={5} hAlign="stretch">
      <VStack gap={1}>
        <Heading level={2}>Billing</Heading>
        <Text type="supporting" color="secondary">
          Choose the plan that fits your loyalty program. The admin activates it
          and invoices you automatically each cycle.
        </Text>
      </VStack>

      {active && (
        <Card padding={5}>
          <HStack gap={4} hAlign="between" vAlign="center" wrap="wrap">
            <VStack gap={1} hAlign="stretch">
              <HStack gap={2} vAlign="center">
                <Heading level={3}>{active.planName}</Heading>
                <Badge variant="green" label="Active" />
              </HStack>
              <Text type="supporting" color="secondary">
                {formatPKR(active.planPrice)} {cycleWord(active.billingCycle)}
                {active.nextBillingAt
                  ? ` · next invoice ${new Date(active.nextBillingAt).toLocaleDateString()}`
                  : ""}
              </Text>
            </VStack>
          </HStack>
        </Card>
      )}

      {pending && (
        <Banner
          status="info"
          title={`${pending.planName} pending approval. You will be switched once the admin activates it.`}
          container="card"
        />
      )}

      {plans.length === 0 ? (
        <EmptyState
          title="No plans available"
          description="Contact the platform admin to activate a plan for your program."
          isCompact
        />
      ) : (
        <VStack gap={3} hAlign="stretch">
          <Text type="label" weight="bold">
            Available plans
          </Text>
          {plans.map((plan) => {
            const isSelected =
              (active && active.planId === plan.id) ||
              (pending && pending.planId === plan.id);
            return (
              <Card key={plan.id} padding={5}>
                <HStack gap={4} hAlign="between" vAlign="center" wrap="wrap">
                  <VStack gap={1} hAlign="stretch">
                    <Heading level={4}>{plan.name}</Heading>
                    <Text type="supporting" color="secondary">
                      {formatPKR(plan.price)} {cycleWord(plan.billingCycle)}
                      {Number(plan.taxPercent) > 0
                        ? ` · ${plan.taxPercent}% tax`
                        : ""}
                    </Text>
                  </VStack>
                  <Button
                    label={isSelected ? "Selected" : "Select plan"}
                    variant={isSelected ? "secondary" : "primary"}
                    isDisabled={isSelected || request.isPending}
                    onClick={() => handleSelect(plan.id)}
                  />
                </HStack>
              </Card>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
}