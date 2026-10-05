import { defineTheme } from "@astryxdesign/core/theme";

export const neoBrutalistTheme = defineTheme({
  name: "neo-brutalist",
  tokens: {
    // Accent - bold bright blue
    "--color-accent": "light-dark(#0066FF, #4D9BFF)",
    "--color-accent-muted": "light-dark(#0066FF14, #4D9BFF20)",
    "--color-on-accent": "light-dark(#ffffff, #000000)",

    // Neutral
    "--color-neutral": "light-dark(#0000000A, #ffffff0A)",
    "--color-background-surface": "light-dark(#FFFFFF, #111111)",
    "--color-background-body": "light-dark(#F5F5F5, #0A0A0A)",
    "--color-overlay": "light-dark(#000000CC, #000000EE)",
    "--color-overlay-hover": "light-dark(#0000000D, #ffffff0D)",
    "--color-overlay-pressed": "light-dark(#0000001A, #ffffff1A)",
    "--color-background-muted": "light-dark(#F0F0F0, #1A1A1A)",

    // Text - high contrast
    "--color-text-primary": "light-dark(#000000, #FFFFFF)",
    "--color-text-secondary": "light-dark(#333333, #CCCCCC)",
    "--color-text-disabled": "light-dark(#999999, #666666)",
    "--color-text-accent": "light-dark(#000000, #FFFFFF)",
    "--color-on-dark": "#ffffff",
    "--color-on-light": "#000000",

    // Icons
    "--color-icon-accent": "light-dark(#000000, #FFFFFF)",
    "--color-icon-primary": "light-dark(#000000, #FFFFFF)",
    "--color-icon-secondary": "light-dark(#333333, #CCCCCC)",
    "--color-icon-disabled": "light-dark(#999999, #666666)",

    // Surfaces
    "--color-background-card": "light-dark(#FFFFFF, #111111)",
    "--color-background-popover": "light-dark(#FFFFFF, #1A1A1A)",

    // Status - bold colors
    "--color-success": "light-dark(#22C55E, #4ADE80)",
    "--color-success-muted": "light-dark(#22C55E14, #4ADE8020)",
    "--color-on-success": "light-dark(#000000, #000000)",
    "--color-error": "light-dark(#EF4444, #F87171)",
    "--color-error-muted": "light-dark(#EF444414, #F8717120)",
    "--color-on-error": "light-dark(#FFFFFF, #000000)",
    "--color-warning": "light-dark(#F59E0B, #FBBF24)",
    "--color-warning-muted": "light-dark(#F59E0B14, #FBBF2414)",
    "--color-on-warning": "light-dark(#000000, #000000)",

    // Borders - thick, brutalist black/white
    "--color-border": "light-dark(#000000, #FFFFFF)",
    "--color-border-emphasized": "light-dark(#000000, #FFFFFF)",
    "--color-skeleton": "light-dark(#E5E5E5, #2A2A2A)",
    "--color-shadow": "light-dark(#000000, #000000)",

    // Categorical colors - bold and high contrast
    "--color-background-blue": "light-dark(#0066FF, #4D9BFF)",
    "--color-border-blue": "light-dark(#000000, #FFFFFF)",
    "--color-icon-blue": "light-dark(#FFFFFF, #000000)",
    "--color-text-blue": "light-dark(#FFFFFF, #000000)",

    "--color-background-cyan": "light-dark(#00D4FF, #67E8FF)",
    "--color-border-cyan": "light-dark(#000000, #FFFFFF)",
    "--color-icon-cyan": "light-dark(#000000, #000000)",
    "--color-text-cyan": "light-dark(#000000, #000000)",

    "--color-background-gray": "light-dark(#E5E5E5, #333333)",
    "--color-border-gray": "light-dark(#000000, #FFFFFF)",
    "--color-icon-gray": "light-dark(#000000, #FFFFFF)",
    "--color-text-gray": "light-dark(#000000, #FFFFFF)",

    "--color-background-green": "light-dark(#22C55E, #4ADE80)",
    "--color-border-green": "light-dark(#000000, #FFFFFF)",
    "--color-icon-green": "light-dark(#000000, #000000)",
    "--color-text-green": "light-dark(#000000, #000000)",

    "--color-background-orange": "light-dark(#FF6B00, #FF9A4D)",
    "--color-border-orange": "light-dark(#000000, #FFFFFF)",
    "--color-icon-orange": "light-dark(#FFFFFF, #000000)",
    "--color-text-orange": "light-dark(#FFFFFF, #000000)",

    "--color-background-pink": "light-dark(#FF3366, #FF6699)",
    "--color-border-pink": "light-dark(#000000, #FFFFFF)",
    "--color-icon-pink": "light-dark(#FFFFFF, #000000)",
    "--color-text-pink": "light-dark(#FFFFFF, #000000)",

    "--color-background-purple": "light-dark(#9333FF, #B366FF)",
    "--color-border-purple": "light-dark(#000000, #FFFFFF)",
    "--color-icon-purple": "light-dark(#FFFFFF, #000000)",
    "--color-text-purple": "light-dark(#FFFFFF, #000000)",

    "--color-background-red": "light-dark(#EF4444, #F87171)",
    "--color-border-red": "light-dark(#000000, #FFFFFF)",
    "--color-icon-red": "light-dark(#FFFFFF, #000000)",
    "--color-text-red": "light-dark(#FFFFFF, #000000)",

    "--color-background-teal": "light-dark(#14B8A6, #5EEAD4)",
    "--color-border-teal": "light-dark(#000000, #FFFFFF)",
    "--color-icon-teal": "light-dark(#000000, #000000)",
    "--color-text-teal": "light-dark(#000000, #000000)",

    "--color-background-yellow": "light-dark(#FBBF24, #FDE047)",
    "--color-border-yellow": "light-dark(#000000, #FFFFFF)",
    "--color-icon-yellow": "light-dark(#000000, #000000)",
    "--color-text-yellow": "light-dark(#000000, #000000)",

    // Sharp radius - core to brutalism
    "--radius-none": "0px",
    "--radius-inner": "0px",
    "--radius-element": "0px",
    "--radius-container": "0px",
    "--radius-page": "0px",
    "--radius-chat": "0px",
    "--radius-full": "0px",

    // Typography - bold, chunky
    "--font-family-body":
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    "--font-family-heading":
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    "--font-family-code":
      'ui-monospace, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',

    "--text-heading-1-weight": "var(--font-weight-bold)",
    "--text-heading-2-weight": "var(--font-weight-bold)",
    "--text-heading-3-weight": "var(--font-weight-bold)",
    "--text-heading-4-weight": "var(--font-weight-bold)",
    "--text-heading-5-weight": "var(--font-weight-bold)",
    "--text-heading-6-weight": "var(--font-weight-bold)",
    "--text-display-1-weight": "var(--font-weight-bold)",
    "--text-display-2-weight": "var(--font-weight-bold)",
    "--text-display-3-weight": "var(--font-weight-bold)",

    "--text-heading-1-leading": "1.1",
    "--text-heading-2-leading": "1.1",
    "--text-heading-3-leading": "1.1",
    "--text-heading-4-leading": "1.1",
    "--text-heading-5-leading": "1.1",
    "--text-heading-6-leading": "1.1",
    "--text-display-1-leading": "1.05",
    "--text-display-2-leading": "1.05",
    "--text-display-3-leading": "1.05",
    "--text-body-leading": "1.5",
    "--text-large-leading": "1.5",

    // Brutalist shadows - hard, offset shadows (no blur)
    "--shadow-low":
      "4px 4px 0px light-dark(#000000, #FFFFFF), inset 0 0 0 1px light-dark(#000000, #FFFFFF)",
    "--shadow-med":
      "6px 6px 0px light-dark(#000000, #FFFFFF), inset 0 0 0 1px light-dark(#000000, #FFFFFF)",
    "--shadow-high":
      "8px 8px 0px light-dark(#000000, #FFFFFF), inset 0 0 0 1px light-dark(#000000, #FFFFFF)",

    // Inset states with bold outlines
    "--shadow-inset-hover": "inset 0px 0px 0px 3px #0066FF",
    "--shadow-inset-selected": "inset 0px 0px 0px 3px #0066FF",
    "--shadow-inset-success": "inset 0px 0px 0px 3px #22C55E",
    "--shadow-inset-warning": "inset 0px 0px 0px 3px #F59E0B",
    "--shadow-inset-error": "inset 0px 0px 0px 3px #EF4444",

    // Motion - snappy, punchy
    "--duration-fast-min": "80ms",
    "--duration-fast": "120ms",
    "--duration-fast-max": "160ms",
    "--duration-medium-min": "200ms",
    "--duration-medium": "280ms",
    "--duration-medium-max": "360ms",
    "--duration-slow-min": "500ms",
    "--duration-slow": "650ms",
    "--duration-slow-max": "900ms",

    // Syntax highlighting
    "--color-syntax-keyword": "light-dark(#9333FF, #B366FF)",
    "--color-syntax-string": "light-dark(#22C55E, #4ADE80)",
    "--color-syntax-comment": "light-dark(#666666, #999999)",
    "--color-syntax-number": "light-dark(#FF6B00, #FF9A4D)",
    "--color-syntax-function": "light-dark(#0066FF, #4D9BFF)",
    "--color-syntax-type": "light-dark(#9333FF, #B366FF)",
    "--color-syntax-variable": "light-dark(#000000, #FFFFFF)",
    "--color-syntax-operator": "light-dark(#666666, #999999)",
    "--color-syntax-constant": "light-dark(#FF6B00, #FF9A4D)",
    "--color-syntax-tag": "light-dark(#EF4444, #F87171)",
    "--color-syntax-attribute": "light-dark(#F59E0B, #FBBF24)",
    "--color-syntax-property": "light-dark(#14B8A6, #5EEAD4)",
    "--color-syntax-punctuation": "light-dark(#666666, #999999)",
    "--color-syntax-background": "light-dark(#FFFFFF, #111111)",
  },
  components: {
    // Button - brutalist style with hard shadows
    button: {
      base: {
        borderWidth: "2px",
        borderStyle: "solid",
        borderColor: "var(--color-border)",
        boxShadow: "4px 4px 0px var(--color-shadow)",
        fontWeight: "var(--font-weight-bold)",
        transition: "all var(--duration-fast) ease",
        ":hover": {
          transform: "translate(-1px, -1px)",
          boxShadow: "5px 5px 0px var(--color-shadow)",
        },
        ":active": {
          transform: "translate(2px, 2px)",
          boxShadow: "2px 2px 0px var(--color-shadow)",
        },
        ":focus-visible": {
          outline: "3px solid var(--color-accent)",
          outlineOffset: "2px",
        },
      },
      "variant:primary": {
        backgroundColor: "var(--color-accent)",
        color: "var(--color-on-accent)",
        borderColor: "var(--color-border)",
      },
      "variant:secondary": {
        backgroundColor: "var(--color-background-surface)",
        color: "var(--color-text-primary)",
        borderColor: "var(--color-border)",
      },
      "variant:ghost": {
        backgroundColor: "transparent",
        color: "var(--color-text-primary)",
        borderColor: "var(--color-border)",
      },
      "variant:destructive": {
        backgroundColor: "var(--color-error)",
        color: "var(--color-on-error)",
        borderColor: "var(--color-border)",
      },
    },
    // Card - bold border and hard shadow
    card: {
      base: {
        borderWidth: "2px",
        borderStyle: "solid",
        borderColor: "var(--color-border)",
        boxShadow: "6px 6px 0px var(--color-shadow)",
        borderRadius: "0px",
        padding: "var(--spacing-4)",
      },
    },
    // Input - bold outline
    input: {
      base: {
        borderWidth: "2px",
        borderStyle: "solid",
        borderColor: "var(--color-border)",
        borderRadius: "0px",
        boxShadow: "inset 2px 2px 0px var(--color-shadow)",
        ":focus-visible": {
          borderColor: "var(--color-accent)",
          outline: "3px solid var(--color-accent)",
          outlineOffset: "1px",
        },
      },
    },
    // Badge - chunky
    badge: {
      base: {
        borderWidth: "1.5px",
        borderStyle: "solid",
        borderColor: "var(--color-border)",
        fontWeight: "var(--font-weight-bold)",
        borderRadius: "0px",
        padding: "2px 8px",
      },
    },
  },
});