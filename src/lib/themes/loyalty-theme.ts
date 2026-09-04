import { defineTheme } from "@astryxdesign/core/theme";

export const loyaltyTheme = defineTheme({
  name: "loyalty",

  // Color configuration
  color: {
    // Primary brand color — warm gold
    accent: "#F5A623",
    // Neutral style: warm-toned neutrals
    neutralStyle: "warm",
  },

  // Typography configuration
  typography: {
    scale: {
      base: 16, // Slightly larger base for readability
      ratio: 1.25, // Generous type scale
    },
    body: {
      family: "Inter, system-ui, -apple-system, sans-serif",
      weight: "400",
    },
    heading: {
      family: "Outfit, Inter, system-ui, sans-serif",
      weight: "600",
    },
  },

  // Radius configuration — friendly rounded corners
  radius: {
    base: 4,
    multiplier: 1.5,
  },

  // Explicit token overrides (optional — fine-tune specific values)
  tokens: {
    // Accent variations
    "--color-accent": ["#F5A623", "#FFD166"],

    // Backgrounds — warm and inviting
    "--color-background-body": ["#FBF8F3", "#12100E"],
    "--color-background-surface": ["#FFFFFF", "#1C1A17"],

    // Text — high contrast for readability
    "--color-text-primary": ["#1A1613", "#F5F0E8"],
    "--color-text-secondary": ["#6B6258", "#A89F94"],

    // Radius tokens
    "--radius-container": "16px",

    // Spacing (customize if needed)
    "--spacing-1": "4px",
    "--spacing-2": "8px",
    "--spacing-3": "12px",
    "--spacing-4": "16px",
    "--spacing-5": "24px",
    "--spacing-6": "32px",
    "--spacing-7": "48px",
    "--spacing-8": "64px",
  },
});
