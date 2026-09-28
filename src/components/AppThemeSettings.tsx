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
  VStack,
} from "@astryxdesign/core";

import {
  themeMap,
  type ThemeMode,
  ThemeName,
  useThemeStore,
} from "@/lib/store/theme";
import AppHeader from "./AppHeader";

export default function AppThemeSetting() {
  const { themeName, mode, setThemeName, setMode } = useThemeStore();

  const modes: { id: ThemeMode; label: string; icon: string }[] = [
    { id: "light", label: "Light", icon: "☀️" },
    { id: "dark", label: "Dark", icon: "🌙" },
    { id: "system", label: "System", icon: "💻" },
  ];

  // Convert the theme map to dropdown options
  const themeOptions = Object.keys(themeMap);

  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="Appearance Settings"
        description="Customize how your loyalty platform looks and feels."
        showButton={false}
        showSearch={false}
      />
      <Stack direction="vertical" gap={5}>
        <Heading level={2}>Theme Mode</Heading>
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
                height={150}
                style={{
                  alignContent: "center",
                }}
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
          <Heading level={2}>Theme Color Palette</Heading>

          <Grid columns={3} gap={5}>
            {themeOptions.map((t) => {
              const isSelected = themeName === t;
              return (
                <SelectableCard
                  key={t}
                  label=""
                  isSelected={isSelected}
                  onChange={() => setThemeName(t as ThemeName)}
                  role="button"
                  height={150}
                  style={{
                    alignContent: "center",
                  }}
                >
                  <Stack direction="vertical" align="center">
                    <Text size="xl">{t}</Text>
                  </Stack>
                </SelectableCard>
              );
            })}
          </Grid>
        </Stack>
      </Stack>
    </VStack>
  );
}
