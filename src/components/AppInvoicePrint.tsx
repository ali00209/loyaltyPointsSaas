"use client";

import { VStack } from "@astryxdesign/core/Layout";
import type { ReactNode } from "react";

const PRINT_STYLES = `@media print {
  body * { visibility: hidden; }
  #invoice-print, #invoice-print * { visibility: visible; }
  #invoice-print {
    position: absolute;
    inset: 0 auto auto 0;
    width: 100%;
  }
}`;

export default function AppInvoicePrint({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <style>{PRINT_STYLES}</style>
      <VStack id="invoice-print" gap={0} hAlign="stretch">
        {children}
      </VStack>
    </>
  );
}