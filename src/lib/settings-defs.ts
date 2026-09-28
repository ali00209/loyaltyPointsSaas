// Program behaviour toggles. Adding a key here is the only way to add a
// toggle: the API schema, the owner form and the engine gates all derive from
// this record, and an unknown key is a hard error rather than a silently
// ignored write. Kept free of db imports so client components can read it.
export const SETTING_DEFS = {
  autoApplyRedemptions: {
    default: true,
    label: "Auto-apply redemption at checkout",
    description:
      "Reserve the best matching redemption rule and deduct points when a checkout comes in. Turn off to handle point discounts yourself in your POS.",
  },
  allowRuleStacking: {
    default: false,
    label: "Stack earning rules",
    description:
      "When one event matches several earning rules, award every match instead of only the highest-value rule.",
  },
  publicStorefront: {
    default: true,
    label: "Public storefront",
    description:
      "Serve the customer-facing program page and purchase history. Turn off to close the program to customers while keeping it running for staff.",
  },
  earnPointsOnRedemption: {
    default: false,
    label: "Earn points on redemption",
    description:
      "When a checkout discount is confirmed, run the customer's purchase rules on what they actually paid. Applies to the amount left after the discount. Rules that depend on line items or product category will not match, because redemption records do not carry the basket. Refunding an order restores the spent points but does not reclaim the points earned here.",
  },
} as const;

export type SettingKey = keyof typeof SETTING_DEFS;

export type AppSettings = { [K in SettingKey]: boolean };

export const SETTING_KEYS = Object.keys(SETTING_DEFS) as SettingKey[];

export const DEFAULT_SETTINGS: AppSettings = Object.fromEntries(
  SETTING_KEYS.map((key) => [key, SETTING_DEFS[key].default]),
) as AppSettings;
