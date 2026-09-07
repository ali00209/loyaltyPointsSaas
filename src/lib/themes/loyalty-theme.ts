import { defineTheme } from "@astryxdesign/core/theme";

export const loyaltyTheme = defineTheme({
  name: "loyalty-theme",
  // accent: single hex, or [light, dark] tuple to seed each scheme separately
  color: { accent: ["#7B61FF", "#9B85FF"], neutralStyle: "cool" },
  typography: {
    scale: { base: 14, ratio: 1.2 },
    body: { family: "Inter", fallbacks: "-apple-system, sans-serif" },
  },
  radius: { base: 0, multiplier: 1 },
  motion: { fast: 175, medium: 410, ratio: 0.75 },
  tokens: {
    // Explicit overrides take precedence over scale-generated values
    "--color-background-body": ["#FFFFFF", "#0A0A0A"],
  },

  components: {
    badge: {
      "variant:info": {
        backgroundColor:
          "var(--astryx-theme-loyalty-theme-color-status-fill-accent)",
      },
    },
    switch: {
      "status:success": {
        radius: "0px",
        backgroundColor:
          "var(--astryx-theme-loyalty-theme-color-status-fill-accent)",
      },
    },
  },
});
