"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@astryxdesign/core/AppShell";
import AppLoading from "@/components/AppLoading";
import AppSideBar from "@/components/AppSideBar";
import { useCurrentUser } from "@/lib/query";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUser();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.push("/");
    else if (user.role === "admin") router.push("/admin");
  }, [isLoading, user, router]);

  if (isLoading || !user || user.role === "admin") {
    return <AppLoading label="Loading your dashboard..." />;
  }

  return (
    <AppShell
      sideNav={<AppSideBar />}
      mobileNav={{ breakpoint: "lg" }}
      contentPadding={6}
    >
      {children}
    </AppShell>
  );
}
