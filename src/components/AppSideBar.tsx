"use client";

import {
  LayoutDashboard,
  Package,
  ShieldCheck,
  Users,
  ArrowLeftRight,
  LogOut,
  Star,
  Building2,
  QrCode,
  CreditCard,
  Receipt,
  Coins,
  Percent,
  Settings,
  User,
  ReceiptText,
  SwatchBook,
  Cable,
  BookOpen,
  SlidersHorizontal,
  TicketSlash,
  AppWindow,
} from "lucide-react";
import type { IconType } from "@astryxdesign/core/Icon";
import {
  SideNav,
  SideNavHeading,
  SideNavItem,
} from "@astryxdesign/core/SideNav";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { type ReactNode, type SVGProps } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppLoading from "./AppLoading";
import { useCurrentUser, useLogout } from "@/lib/query";

interface NavItem {
  label: string;
  href?: string;
  icon?: IconType;
  children?: NavItem[];
}

const ownerNavItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },

  {
    label: "Rules",
    icon: ShieldCheck,
    children: [
      {
        label: "Earning ",
        href: "/dashboard/rules",
        icon: Coins,
      },
      {
        label: "Redemption",
        href: "/dashboard/redemption-rules",
        icon: Percent,
      },
    ],
  },
  {
    label: "Products",
    href: "/dashboard/products",
    icon: Package,
  },
  {
    label: "Customers",
    href: "/dashboard/customers",
    icon: Users,
  },
  {
    label: "Ledger",
    icon: BookOpen,
    children: [
      {
        label: "Transactions",
        href: "/dashboard/transactions",
        icon: ArrowLeftRight,
      },
      {
        label: "Redemptions",
        href: "/dashboard/transactions/redemptions",
        icon: TicketSlash,
      },
    ],
  },
  {
    label: "Store QR",
    href: "/dashboard/qr",
    icon: QrCode,
  },
  {
    label: "Settings",
    icon: Settings,
    children: [
      { label: "Profile", href: "/dashboard/settings/profile", icon: User },
      {
        label: "Billing",
        href: "/dashboard/settings/billing",
        icon: CreditCard,
      },
      {
        label: "Invoices",
        href: "/dashboard/settings/invoices",
        icon: ReceiptText,
      },
      { label: "Theme", href: "/dashboard/settings/theme", icon: SwatchBook },
      { label: "Api", href: "/dashboard/settings/api", icon: Cable },
      {
        label: "App",
        href: "/dashboard/settings/app",
        icon: SlidersHorizontal,
      },
    ],
  },
];

const adminNavItems: NavItem[] = [
  {
    label: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Tenants",
    href: "/admin/tenants",
    icon: Building2,
  },
  {
    label: "Plans",
    href: "/admin/plans",
    icon: CreditCard,
  },
  {
    label: "Invoices",
    href: "/admin/invoices",
    icon: Receipt,
  },
];

export default function AppSideBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isLoading } = useCurrentUser();
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    router.push("/");
  };

  if (isLoading) {
    return <AppLoading label="Loading..." />;
  }

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const navItems = isAdmin ? adminNavItems : ownerNavItems;

  const isWithin = (href?: string) =>
    href != null &&
    (pathname === href ||
      (href !== "/dashboard" &&
        href !== "/admin" &&
        pathname.startsWith(href + "/")));

  const branchIsActive = (item: NavItem) =>
    isWithin(item.href) ||
    (item.children?.some((child) => isWithin(child.href)) ?? false);

  const renderItem = (item: NavItem): ReactNode => {
    return (
      <SideNavItem
        key={item.href ?? item.label}
        label={item.label}
        href={item.href}
        icon={item.icon}
        collapsible={
          item.children
            ? branchIsActive(item)
              ? { isCollapsed: false }
              : { defaultIsCollapsed: true }
            : undefined
        }
        isSelected={isWithin(item.href)}
      >
        {item.children?.map(renderItem)}
      </SideNavItem>
    );
  };

  return (
    <SideNav
      header={
        <SideNavHeading
          heading={isAdmin ? "LoyaltyHub" : user.tenant?.name || "LoyaltyHub"}
          subheading={isAdmin ? "Platform Admin" : "Owner Dashboard"}
          icon={
            <HStack width={36} height={36} hAlign="center" vAlign="center">
              <Icon icon={Star} size="md" />
            </HStack>
          }
        />
      }
      footer={
        <VStack gap={2} hAlign="stretch">
          <HStack gap={2}>
            <Avatar name={user.name} size="md" />
            <VStack gap={0} hAlign="stretch">
              <Text type="body" weight="medium" maxLines={1}>
                {user.name}
              </Text>
              <Text type="supporting" color="secondary" maxLines={1}>
                {user.email}
              </Text>
            </VStack>
          </HStack>
          <Button
            label="Sign Out"
            variant="ghost"
            width="100%"
            icon={<LogOut size="1em" />}
            onClick={handleLogout}
          />
        </VStack>
      }
    >
      {navItems.map(renderItem)}
    </SideNav>
  );
}
