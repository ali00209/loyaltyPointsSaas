"use client";

import { EmptyState } from "@astryxdesign/core";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { useParams } from "next/navigation";
import AppApiSetting from "@/components/AppApiSettings";
import AppBillingSetting from "@/components/AppBillingSetting";
import AppInvoicesSetting from "@/components/AppInvoicesSetting";
import AppProfileSetting from "@/components/AppProfileSetting";
import AppThemeSetting from "@/components/AppThemeSettings";

const SETTINGS_TABS = {
  profile: AppProfileSetting,
  billing: AppBillingSetting,
  invoices: AppInvoicesSetting,
  theme: AppThemeSetting,
  api: AppApiSetting,
} as const;

export default function SettingsTabPage() {
  const { tab } = useParams<{ tab: string }>();
  const Panel = SETTINGS_TABS[tab as keyof typeof SETTINGS_TABS];

  return (
    <Layout height="fill" contentWidth={1440} padding={10}>
      <LayoutContent padding={4}>
        {Panel ? <Panel /> : <EmptyState title="comming soon..." />}
      </LayoutContent>
    </Layout>
  );
}
