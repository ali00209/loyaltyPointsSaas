"use client";

import { VStack, Stack, Divider } from "@astryxdesign/core";
import { Switch } from "@astryxdesign/core/Switch";
import { useToast } from "@astryxdesign/core/Toast";
import AppHeader from "@/components/AppHeader";
import AppLoading from "@/components/AppLoading";
import { SETTING_DEFS, type SettingKey } from "@/lib/settings-defs";
import { useAppSettings, useSaveAppSettings } from "@/lib/query";

export default function AppAppSetting() {
  const { data: settings, isLoading } = useAppSettings();
  const saveSettings = useSaveAppSettings();
  const showToast = useToast();

  if (isLoading) return <AppLoading label="Loading settings..." />;

  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="App Settings"
        description="Control how your loyalty program behaves. Changes apply to future events only — existing points and history are never rewritten."
        showButton={false}
        showSearch={false}
      />
      <Stack direction="vertical" align="stretch" gap={4}>
        {Object.entries(SETTING_DEFS).map(([key, def], index) => (
          <Stack key={key} direction="vertical" align="stretch" gap={4}>
            {index > 0 && <Divider />}
            <Switch
              label={def.label}
              description={def.description}
              labelPosition="start"
              labelSpacing="spread"
              width="100%"
              value={settings?.[key as SettingKey] ?? def.default}
              changeAction={async (checked) => {
                try {
                  await saveSettings.mutateAsync({
                    [key]: checked,
                  } as Partial<Record<SettingKey, boolean>>);
                  showToast({
                    type: "info",
                    body: `${def.label} ${checked ? "enabled" : "disabled"}`,
                  });
                } catch (err) {
                  showToast({
                    type: "error",
                    body: err instanceof Error ? err.message : "Unable to save setting",
                  });
                  throw err;
                }
              }}
            />
          </Stack>
        ))}
      </Stack>
    </VStack>
  );
}
