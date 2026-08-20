// Copyright (c) Meta Platforms, Inc. and affiliates.

"use client";

import { useState } from "react";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import {
  VStack,
  HStack,
  StackItem,
  Layout,
  LayoutContent,
  LayoutHeader,
  LayoutPanel,
} from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { List, ListItem } from "@astryxdesign/core/List";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { Text, Heading } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Typeahead } from "@astryxdesign/core/Typeahead";
import type {
  SearchableItem,
  SearchSource,
} from "@astryxdesign/core/Typeahead";
import { SearchIcon } from "lucide-react";
import AppProfileSetting from "@/components/AppProfileSetting";
import AppApiSetting from "@/components/AppApiSettings";
import { EmptyState } from "@astryxdesign/core";
import AppHeader from "@/components/AppHeader";
import AppThemeSetting from "@/components/AppThemeSettings";

const NAV_ITEMS = ["Profile", "Members", "Billing", "Invoices", "Theme", "API"];

const SETTINGS_ITEMS: SearchableItem[] = [
  { id: "1", label: "Username" },
  { id: "2", label: "First name" },
  { id: "3", label: "Last name" },
  { id: "4", label: "Email address" },
  { id: "5", label: "Change password" },
  { id: "6", label: "Data Export Access" },
  { id: "7", label: "Allow Admin to Add Members" },
  { id: "8", label: "Two-Factor Authentication" },
];

const settingsSearchSource: SearchSource<SearchableItem> = {
  search: (query: string) =>
    SETTINGS_ITEMS.filter((item) =>
      item.label.toLowerCase().includes(query.toLowerCase()),
    ),
  bootstrap: () => SETTINGS_ITEMS,
};

export default function SettingsTemplate() {
  const isNarrow = useMediaQuery("(max-width: 768px)");
  const [activeNav, setActiveNav] = useState("Profile");
  const [searchValue, setSearchValue] = useState<SearchableItem | null>(null);

  return (
    <Layout
      height="fill"
      contentWidth={1440}
      padding={10}
      header={
        <LayoutHeader hasDivider>
          <HStack vAlign="center">
            <StackItem size="fill">
              <Heading level={1}>Settings</Heading>
            </StackItem>
            <Typeahead
              label="Search"
              isLabelHidden
              placeholder="Search settings..."
              searchSource={settingsSearchSource}
              value={searchValue}
              onChange={setSearchValue}
              hasEntriesOnFocus
              startIcon={SearchIcon}
            />
          </HStack>
        </LayoutHeader>
      }
      start={
        isNarrow ? undefined : (
          <LayoutPanel hasDivider={false} width={260} padding={2}>
            <List density="balanced">
              {NAV_ITEMS.map((item) => (
                <ListItem
                  key={item}
                  label={item}
                  isSelected={activeNav === item}
                  onClick={() => setActiveNav(item)}
                />
              ))}
            </List>
          </LayoutPanel>
        )
      }
      content={
        <LayoutContent padding={4}>
          {isNarrow && (
            <VStack hAlign="center">
              <TabList value={activeNav} onChange={setActiveNav}>
                {NAV_ITEMS.map((item) => (
                  <Tab key={item} value={item} label={item} />
                ))}
              </TabList>
            </VStack>
          )}
          {activeNav === "Profile" ? (
            <AppProfileSetting />
          ) : activeNav === "API" ? (
            <AppApiSetting />
          ) : activeNav === "Theme" ? (
            <AppThemeSetting />
          ) : (
            <EmptyState title="comming soon..." />
          )}
        </LayoutContent>
      }
    />
  );
}
