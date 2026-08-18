"use client";

import {
  Card,
  Stack,
  Heading,
  Button,
  Badge,
  Text,
  SelectableCard,
  Divider,
  Grid,
  Selector,
} from "@astryxdesign/core";

import {
  themeMap,
  type ThemeMode,
  ThemeName,
  useThemeStore,
} from "@/lib/store/theme";

const themeLabels: Record<ThemeName, string> = {
  y2k: "Y2K",
  loyalty: "Loyalty Gold",
  neutral: "Neutral",
  butter: "Butter",
  matcha: "Matcha",
};

export default function AppThemeSetting() {
  const { themeName, mode, setThemeName, setMode } = useThemeStore();

  const modes: { id: ThemeMode; label: string; icon: string }[] = [
    { id: "light", label: "Light", icon: "☀️" },
    { id: "dark", label: "Dark", icon: "🌙" },
    { id: "system", label: "System", icon: "💻" },
  ];

  // Convert the theme map to dropdown options
  const themeOptions = Object.keys(themeMap).map((key) => ({
    value: key as ThemeName,
    label: themeLabels[key as ThemeName] || key,
  }));

  return (
    <Card>
      <Stack direction="vertical" gap={2}>
        <Stack direction="vertical" gap={2}>
          <Heading level={2}>Appearance Settings</Heading>
          <Text size="sm">
            Customize how your loyalty platform looks and feels.
          </Text>
        </Stack>

        <Heading level={3}>Mode</Heading>
        <Grid columns={3} gap={5}>
          {modes.map(({ id, label, icon }) => {
            const isSelected = mode === id;
            return (
              <SelectableCard
                key={id}
                label=""
                isSelected={isSelected}
                onChange={() => setMode(id)}
                role="button"
              >
                <Stack direction="vertical" align="center">
                  <Text size="xl">{icon}</Text>
                  <Text weight="medium">{label}</Text>
                </Stack>
              </SelectableCard>
            );
          })}
        </Grid>

        {/* Divider */}
        <Divider />

        <Stack direction="vertical" align="stretch" gap={2}>
          <Heading level={4}>Theme Color Palette</Heading>

          <Selector
            label=""
            value={themeName}
            onChange={(v) => setThemeName(v as ThemeName)}
            options={themeOptions.map((op) => ({
              label: op.label,
              value: op.label,
            }))}
          />
        </Stack>

        {/* Footer note */}
        {/*<Text variant="subtle" size="sm" align="center">
          Changes apply instantly. Your preference is saved locally.
        </Text>*/}
      </Stack>
    </Card>
  );
}
