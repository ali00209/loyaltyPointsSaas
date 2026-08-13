"use client";

import { LayerProvider, Theme } from "@astryxdesign/core";
import { neutralTheme } from "@astryxdesign/theme-neutral";
import { y2kTheme } from "@astryxdesign/theme-y2k";
import { loyaltyhubTheme } from "../themes/loyaltyhub/loyaltyhubTheme";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Theme theme={y2kTheme}>
      <LayerProvider>{children}</LayerProvider>
    </Theme>
  );
}
