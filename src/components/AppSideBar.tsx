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
  Settings,
  QrCode,
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
import { type SVGProps } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppLoading from "./AppLoading";
import { useCurrentUser, useLogout } from "@/lib/query";

function fillIcon(IconComponent: IconType): IconType {
  return function FilledIcon(props: SVGProps<SVGSVGElement>) {
    return <IconComponent {...props} fill="currentColor" />;
  };
}

const ownerNavItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    selectedIcon: fillIcon(LayoutDashboard),
  },
  {
    label: "Products",
    href: "/dashboard/products",
    icon: Package,
    selectedIcon: fillIcon(Package),
  },
  {
    label: "Rules",
    href: "/dashboard/rules",
    icon: ShieldCheck,
    selectedIcon: fillIcon(ShieldCheck),
  },
  {
    label: "Redemption Rules",
    href: "/dashboard/redemption-rules",
    icon: ShieldCheck,
    selectedIcon: fillIcon(ShieldCheck),
  },
  {
    label: "Customers",
    href: "/dashboard/customers",
    icon: Users,
    selectedIcon: fillIcon(Users),
  },
  {
    label: "Transactions",
    href: "/dashboard/transactions",
    icon: ArrowLeftRight,
    selectedIcon: fillIcon(ArrowLeftRight),
  },
  {
    label: "Store QR",
    href: "/dashboard/qr",
    icon: QrCode,
    selectedIcon: fillIcon(QrCode),
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    selectedIcon: fillIcon(Settings),
  },
];

const adminNavItems = [
  {
    label: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
    selectedIcon: fillIcon(LayoutDashboard),
  },
  {
    label: "Tenants",
    href: "/admin/tenants",
    icon: Building2,
    selectedIcon: fillIcon(Building2),
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
      {navItems.map((item) => (
        <SideNavItem
          key={item.href}
          label={item.label}
          href={item.href}
          icon={item.icon}
          selectedIcon={item.selectedIcon}
          isSelected={
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              item.href !== "/admin" &&
              pathname.startsWith(item.href + "/"))
          }
        />
      ))}
    </SideNav>
  );
}
