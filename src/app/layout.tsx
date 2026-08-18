import type { Metadata } from "next";
import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query";
import "./globals.css";
import { ThemeProvider } from "./provider";

export const metadata: Metadata = {
  title: "LoyaltyHub - Smart Loyalty Points Management",
  description: "SaaS loyalty points platform for POS and e-commerce businesses",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-body text-primary antialiased min-h-screen">
        <QueryProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
