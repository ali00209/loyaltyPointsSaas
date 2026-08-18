"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, KeyRound, RefreshCw } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Banner } from "@astryxdesign/core/Banner";
import { useImperativeAlertDialog } from "@astryxdesign/core/AlertDialog";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import AppHeader from "@/components/AppHeader";
import { useApiKey, useCurrentUser, useRegenerateApiKey } from "@/lib/query";
import type { ApiKeyRegenerateResult } from "@/types";

export default function AppApiSetting() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: apiKey, isLoading: apiKeyLoading } = useApiKey();
  const regenerateMutation = useRegenerateApiKey();
  const [newKey, setNewKey] = useState<ApiKeyRegenerateResult | null>(null);
  const showToast = useToast();
  const alert = useImperativeAlertDialog();

  const slug = (user?.tenant as { slug?: string } | null | undefined)?.slug;
  const portalUrl = slug ? `/p/${slug}` : null;

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ type: "info", body: successMessage });
    } catch {
      showToast({ type: "error", body: "Failed to copy to clipboard" });
    }
  };

  const handleRegenerate = () => {
    alert.show({
      title: "Regenerate API key?",
      description:
        "Your current API key will stop working immediately. Any systems using it must be updated before you continue.",
      actionLabel: "Regenerate",
      isActionLoading: regenerateMutation.isPending,
      onAction: async () => {
        try {
          const result = await regenerateMutation.mutateAsync(undefined);
          setNewKey(result);
          showToast({ type: "info", body: "API key generated" });
          alert.hide();
        } catch {
          showToast({ type: "error", body: "Failed to generate API key" });
        }
      },
    });
  };

  if (userLoading || apiKeyLoading) {
    return <AppLoading label="Loading settings..." />;
  }

  return (
    <VStack gap={6} hAlign="stretch">
      <Card padding={6}>
        <VStack gap={4} hAlign="stretch">
          <Heading level={2}>Portal</Heading>
          <Text type="body" color="secondary">
            Your customers use this link to sign up and log in to your loyalty
            program.
          </Text>
          {portalUrl ? (
            <HStack gap={2} vAlign="center">
              <Text type="code">{portalUrl}</Text>
              <Button
                label="Copy"
                variant="secondary"
                icon={<Copy size="1em" />}
                onClick={() => copyToClipboard(portalUrl, "Portal link copied")}
              />
              <Button
                label="Open"
                variant="primary"
                as={Link}
                href={portalUrl}
                target="_blank"
                icon={<ExternalLink size="1em" />}
              />
            </HStack>
          ) : (
            <Text type="body" color="secondary">
              No portal link is available for this account.
            </Text>
          )}
        </VStack>
      </Card>

      <Card padding={6}>
        <VStack gap={4} hAlign="stretch">
          <Heading level={2}>API Key</Heading>
          <Text type="body" color="secondary">
            Use this key to report events to your loyalty program from your own
            systems.
          </Text>

          {newKey ? (
            <VStack gap={3} hAlign="stretch">
              <Banner
                status="success"
                title={
                  newKey.note ||
                  "Store this key now. It is hashed and cannot be shown again."
                }
                container="card"
              />
              <HStack gap={2} vAlign="center">
                <Text type="code">{newKey.key}</Text>
                <Button
                  label="Copy"
                  variant="secondary"
                  icon={<Copy size="1em" />}
                  onClick={() =>
                    copyToClipboard(newKey.key ?? "", "API key copied")
                  }
                />
              </HStack>
            </VStack>
          ) : apiKey?.configured ? (
            <VStack gap={3} hAlign="stretch">
              <HStack gap={6} vAlign="start">
                {apiKey.name && (
                  <VStack gap={0} hAlign="stretch">
                    <Text type="supporting" color="secondary">
                      Name
                    </Text>
                    <Text type="body">{apiKey.name}</Text>
                  </VStack>
                )}
                {apiKey.createdAt && (
                  <VStack gap={0} hAlign="stretch">
                    <Text type="supporting" color="secondary">
                      Created
                    </Text>
                    <Text type="body">
                      {new Date(apiKey.createdAt).toLocaleDateString()}
                    </Text>
                  </VStack>
                )}
                {apiKey.lastUsedAt && (
                  <VStack gap={0} hAlign="stretch">
                    <Text type="supporting" color="secondary">
                      Last used
                    </Text>
                    <Text type="body">
                      {new Date(apiKey.lastUsedAt).toLocaleDateString()}
                    </Text>
                  </VStack>
                )}
              </HStack>
              <HStack gap={2}>
                <Button
                  label="Regenerate"
                  variant="secondary"
                  icon={<RefreshCw size="1em" />}
                  onClick={handleRegenerate}
                />
              </HStack>
            </VStack>
          ) : (
            <VStack gap={3} hAlign="stretch">
              <Text type="body" color="secondary">
                No API key has been generated for this program yet.
              </Text>
              <HStack gap={2}>
                <Button
                  label="Generate API key"
                  variant="primary"
                  icon={<KeyRound size="1em" />}
                  onClick={handleRegenerate}
                />
              </HStack>
            </VStack>
          )}

          <Banner
            status="info"
            title="Report a purchase event with your API key"
            container="card"
          />
          <VStack gap={1} hAlign="stretch">
            <Text type="code">POST /api/events</Text>
            <Text type="code">Authorization: Bearer &lt;KEY&gt;</Text>
            <Text type="code">
              {`{ "eventType": "purchase", "customerEmail": "customer@example.com", "payload": { "orderAmount": 25.5 } }`}
            </Text>
          </VStack>
        </VStack>
      </Card>

      {alert.element}
    </VStack>
  );
}
