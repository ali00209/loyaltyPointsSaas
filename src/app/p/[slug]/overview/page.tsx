"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeftRight, Copy, Gift, Mail, MapPin, Share2 } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Center } from "@astryxdesign/core/Center";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import {
  usePortalCustomer,
  usePortalOverview,
  usePostPortalEvent,
} from "@/lib/query";

const txTypeBadge: Record<string, "green" | "red" | "blue" | "neutral"> = {
  earn: "green",
  redeem: "red",
  adjust: "blue",
  expire: "neutral",
};

const txTypeLabels: Record<string, string> = {
  earn: "Earn",
  redeem: "Redeem",
  adjust: "Adjust",
  expire: "Expired",
};

export default function OverviewPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const showToast = useToast();
  const { data: customer, isLoading: customerLoading } = usePortalCustomer();
  const { data: overview, isLoading: overviewLoading } = usePortalOverview();
  const shareMutation = usePostPortalEvent();
  const newsletterMutation = usePostPortalEvent();
  const checkInMutation = usePostPortalEvent();
  const [copied, setCopied] = useState(false);

  if (customerLoading || overviewLoading) {
    return <AppLoading label="Loading your rewards..." />;
  }

  if (!customer) {
    return (
      <Center axis="both" className="min-h-dvh">
        <EmptyState
          title="Please log in"
          description="Log in to see your points balance and rewards."
          actions={
            <Link
              href={`/p/${slug}`}
              className="text-accent font-medium hover:underline"
            >
              Log in
            </Link>
          }
        />
      </Center>
    );
  }

  if (!overview) {
    return (
      <Center axis="both" className="min-h-dvh">
        <EmptyState title="Failed to load your points" isCompact />
      </Center>
    );
  }

  const handleCopy = async () => {
    try {
      const url = `${window.location.origin}${overview.referral.link}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast({ type: "info", body: "Referral link copied" });
    } catch {
      showToast({ type: "error", body: "Failed to copy link" });
    }
  };

  const handleShare = async () => {
    try {
      const result = await shareMutation.mutateAsync({
        eventType: "social_share",
        payload: { platform: "instagram" },
      });
      showToast({ type: "info", body: `+${result.totalAwarded} pts` });
    } catch (err) {
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to record share",
      });
    }
  };

  const handleNewsletter = async () => {
    try {
      const result = await newsletterMutation.mutateAsync({
        eventType: "newsletter_signup",
        payload: {},
      });
      showToast({ type: "info", body: `+${result.totalAwarded} pts` });
    } catch (err) {
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to join newsletter",
      });
    }
  };

  const handleCheckIn = async () => {
    try {
      const result = await checkInMutation.mutateAsync({
        eventType: "visit",
        payload: {},
      });
      if (result.totalAwarded > 0) {
        showToast({ type: "info", body: `Checked in! +${result.totalAwarded} pts` });
      } else {
        showToast({ type: "info", body: "Already checked in today" });
      }
    } catch (err) {
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to check in",
      });
    }
  };

  return (
    <VStack gap={6} hAlign="stretch">
      <VStack gap={1}>
        <Heading level={1}>Hi {customer.name}</Heading>
        <Text type="body" color="secondary">
          Here&apos;s your points balance and recent activity
        </Text>
      </VStack>

      <Grid columns={{ minWidth: 280, repeat: "fill" }} gap={6}>
        <Card padding={6}>
          <VStack gap={3} hAlign="stretch">
            <Text type="supporting" color="secondary">
              Current balance
            </Text>
            <Text type="body" size="4xl" weight="bold" hasTabularNumbers>
              {overview.summary.currentBalance.toLocaleString()} pts
            </Text>
            <Text type="supporting" color="secondary">
              {overview.summary.totalPointsEarned.toLocaleString()} total earned
            </Text>
          </VStack>
        </Card>

        <Card padding={6}>
          <VStack gap={3} hAlign="stretch">
            <HStack gap={2} vAlign="center">
              <Icon icon={Gift} size="sm" />
              <Text type="body" weight="medium">
                Refer a friend
              </Text>
            </HStack>
            {overview.referral.code ? (
              <>
                <VStack gap={1} hAlign="stretch">
                  <Text type="supporting" color="secondary">
                    Your code
                  </Text>
                  <Text type="code" weight="medium">
                    {overview.referral.code}
                  </Text>
                </VStack>
                <Text type="supporting" color="secondary" maxLines={2}>
                  {overview.referral.link}
                </Text>
                <Button
                  label={copied ? "Copied" : "Copy link"}
                  variant="secondary"
                  icon={<Copy size="1em" />}
                  onClick={handleCopy}
                />
              </>
            ) : (
              <Text type="body" color="secondary">
                No referral code available
              </Text>
            )}
          </VStack>
        </Card>
      </Grid>

      <Card padding={6}>
        <VStack gap={3} hAlign="stretch">
          <Heading level={2}>Earn more points</Heading>
          <HStack gap={3} wrap="wrap">
            <Button
              label="Check in"
              variant="primary"
              icon={<MapPin size="1em" />}
              isLoading={checkInMutation.isPending}
              onClick={handleCheckIn}
            />
            <Button
              label="Share on social"
              variant="secondary"
              icon={<Share2 size="1em" />}
              isLoading={shareMutation.isPending}
              onClick={handleShare}
            />
            <Button
              label="Join newsletter"
              variant="secondary"
              icon={<Mail size="1em" />}
              isLoading={newsletterMutation.isPending}
              onClick={handleNewsletter}
            />
          </HStack>
        </VStack>
      </Card>

      <Card padding={6}>
        <VStack gap={4} hAlign="stretch">
          <Heading level={2}>Points history</Heading>
          {overview.activity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Earn points on your next purchase"
              icon={<Icon icon={ArrowLeftRight} size="lg" />}
              isCompact
            />
          ) : (
            <List hasDividers density="compact">
              {overview.activity.map((a) => (
                <ListItem
                  key={a.id}
                  label={a.ruleName ?? a.source ?? "Points activity"}
                  description={a.description ?? undefined}
                  startContent={
                    <Badge
                      variant={txTypeBadge[a.transactionType] || "neutral"}
                      label={txTypeLabels[a.transactionType] || a.transactionType}
                    />
                  }
                  endContent={
                    <VStack gap={0} hAlign="end">
                      <Text
                        type="body"
                        weight="bold"
                        hasTabularNumbers
                        className={
                          a.points > 0 ? "text-green-vivid" : "text-red-vivid"
                        }
                      >
                        {a.points > 0 ? "+" : ""}
                        {a.points}
                      </Text>
                      <Text type="supporting" color="secondary">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </Text>
                    </VStack>
                  }
                />
              ))}
            </List>
          )}
        </VStack>
      </Card>

      <Text type="supporting" color="secondary">
        Points expire according to this program&apos;s rules.
      </Text>
    </VStack>
  );
}
