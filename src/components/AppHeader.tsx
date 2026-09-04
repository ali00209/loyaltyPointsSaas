"use client";

import { search } from "@astryxdesign/cli/api";
import {
  HStack,
  VStack,
  Button,
  TextInput,
  Heading,
  Text,
  Selector,
} from "@astryxdesign/core";
import { Plus, Search } from "lucide-react";

export default function AppHeader({
  heading,
  description,
  showButton,
  onClick,
  showSearch = true,
  search,
  setSearch,
  showFilter,
  filterOptions,
  filterValue,
  setFilterValue,
  customButton,
}: {
  heading: string;
  description: string;
  showButton: boolean;
  customButton?: React.ReactElement;
  onClick?: () => void;
  showSearch?: boolean;
  search?: string;
  setSearch?: (search: string) => void;
  showFilter?: boolean;
  filterOptions?: string[];
  filterValue?: string;
  setFilterValue?: (filterValue: string) => void;
}) {
  return (
    <>
      <HStack hAlign="between" vAlign="center">
        <VStack gap={1}>
          <Heading level={1}>{heading}</Heading>
          <Text type="body" color="secondary">
            {description}
          </Text>
        </VStack>
        {showButton && (
          <Button
            label={`Add ${heading}`}
            variant="primary"
            icon={<Plus size="1em" />}
            onClick={onClick}
          />
        )}
        {customButton && customButton}
      </HStack>

      <HStack gap={3} vAlign="center">
        {showSearch && (
          <TextInput
            label={`Search ${heading}`}
            isLabelHidden
            placeholder={`Search ${heading}...`}
            startIcon={Search}
            hasClear
            value={search || ""}
            onChange={setSearch}
            width="100%"
          />
        )}
        {showFilter && (
          <HStack gap={1} vAlign="center">
            <Selector
              label=""
              options={filterOptions || []}
              value={filterValue}
              onChange={setFilterValue}
            />
          </HStack>
        )}
      </HStack>
    </>
  );
}
