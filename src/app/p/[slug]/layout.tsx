"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { LogOut, Star } from "lucide-react";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Center } from "@astryxdesign/core/Center";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import AppLoading from "@/components/AppLoading";
import {
  usePortalCustomer,
  usePortalLogout,
  usePortalTenant,
} from "@/lib/query";

export default function PortalLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { data: tenant, isLoading: tenantLoading } = usePortalTenant(slug);
  const { data: customer, isLoading: customerLoading } = usePortalCustomer();
  const logoutMutation = usePortalLogout();

  const brandColor = tenant?.brandingConfig?.brandColor ?? undefined;
  const logoBackground = brandColor
    ? { backgroundColor: brandColor }
    : undefined;

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    router.push(`/p/${slug}`);
  };

  if (tenantLoading || customerLoading) {
    return <AppLoading label="Loading..." />;
  }

  if (!tenant) {
    return (
      <Center axis="both" className="min-h-dvh">
        <EmptyState
          title="Program not found"
          description="This loyalty program does not exist or is no longer available."
          isCompact
        />
      </Center>
    );
  }

  if (tenant.suspended) {
    return (
      <Center axis="both" className="min-h-dvh">
        <EmptyState title="This loyalty program is suspended" isCompact />
      </Center>
    );
  }

  return (
    <VStack gap={0} hAlign="stretch" className="min-h-dvh bg-body text-primary">
      <HStack
        gap={4}
        hAlign="between"
        vAlign="center"
        width="100%"
        className="px-6 py-4"
      >
        <HStack gap={3} vAlign="center">
          <HStack
            width={36}
            height={36}
            hAlign="center"
            vAlign="center"
            style={logoBackground}
            className="rounded-lg bg-(--color-brand-gold) text-(--color-brand-ink)"
          >
            <Icon icon={Star} size="md" />
          </HStack>
          <Text type="body" weight="bold" size="lg">
            {tenant.name}
          </Text>
        </HStack>
        {customer ? (
          <HStack gap={4} vAlign="center">
            <Link
              href={`/p/${slug}/overview`}
              className="text-secondary hover:text-primary text-sm font-medium"
            >
              Overview
            </Link>
            <Link
              href={`/p/${slug}/purchases`}
              className="text-secondary hover:text-primary text-sm font-medium"
            >
              Purchases
            </Link>
            <Button
              label="Sign out"
              variant="ghost"
              size="sm"
              icon={<LogOut size="1em" />}
              onClick={handleLogout}
            />
          </HStack>
        ) : (
          <Link
            href={`/p/${slug}`}
            className="text-secondary hover:text-primary text-sm font-medium"
          >
            Log in
          </Link>
        )}
      </HStack>
      <Divider />
      <VStack gap={6} hAlign="stretch" width="100%" className="px-6 py-8">
        {children}
      </VStack>
    </VStack>
  );
}
