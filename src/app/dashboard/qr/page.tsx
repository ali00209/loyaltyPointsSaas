"use client";

import { useMemo, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Heading } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import AppHeader from "@/components/AppHeader";
import AppLoading from "@/components/AppLoading";
import { useStoreQr } from "@/lib/query";

const GAP_OPTIONS = [
  { value: "0", label: "None" },
  { value: "2", label: "2 mm" },
  { value: "4", label: "4 mm" },
  { value: "6", label: "6 mm" },
  { value: "8", label: "8 mm" },
  { value: "10", label: "10 mm" },
];

export default function StoreQrPage() {
  const { data, isLoading } = useStoreQr();
  const [columns, setColumns] = useState(2);
  const [rows, setRows] = useState(2);
  const [gap, setGap] = useState("4");
  const [pages, setPages] = useState(1);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const perPage = Math.max(1, columns * rows);
  const gapMm = Number(gap);

  const copies = useMemo(
    () => (data ? Array.from({ length: perPage }, (_, i) => i) : []),
    [data, perPage],
  );

  if (isLoading || !data) {
    return <AppLoading label="Loading QR code..." />;
  }

  const handlePrint = () => {
    const pageBlocks = Array.from({ length: pages }, (_, p) => {
      const imgs = copies
        .map(
          () =>
            `<img src="${data.qrDataUrl}" alt="QR code for ${data.portalUrl}" />`,
        )
        .join("");
      return `<div class="page">${imgs}</div>`;
    }).join("");

    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { margin: 0; }
      .page {
        display: grid;
        grid-template-columns: repeat(${columns}, 1fr);
        grid-template-rows: repeat(${rows}, 1fr);
        gap: ${gapMm}mm;
        width: 210mm;
        height: 297mm;
        box-sizing: border-box;
        padding: 10mm;
        break-after: page;
      }
      .page:last-child { break-after: auto; }
      .page img { width: 100%; height: 100%; object-fit: contain; }
      @page { size: A4; margin: 0; }
    </style></head><body>${pageBlocks}</body></html>`;

    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = doc;
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };
  };

  return (
    <VStack gap={6}>
      <AppHeader
        heading="Store QR"
        description="Scan this at your counter to open your loyalty portal for check-in."
        showButton={false}
        showSearch={false}
      />

      <HStack gap={6} align="start" wrap="wrap">
        <div className="qr-preview">
          <div className="qr-sheet">
            {copies.map((i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={data.qrDataUrl}
                alt={`QR code for ${data.portalUrl}`}
              />
            ))}
          </div>
        </div>

        <VStack gap={4} hAlign="start" width={240}>
          <Heading level={4}>Print layout</Heading>
          <HStack gap={3} align="end">
            <NumberInput
              label="Columns"
              value={columns}
              min={1}
              max={10}
              onChange={setColumns}
            />
            <NumberInput
              label="Rows"
              value={rows}
              min={1}
              max={10}
              onChange={setRows}
            />
          </HStack>
          <Selector
            label="Spacing"
            description={`${perPage} codes per page`}
            options={GAP_OPTIONS}
            value={gap}
            onChange={(v) => setGap(v ?? "4")}
          />
          <NumberInput
            label="Pages"
            value={pages}
            min={1}
            max={50}
            onChange={setPages}
          />
          <Button
            label="Print"
            variant="primary"
            icon={<Printer size="1em" />}
            onClick={handlePrint}
          />
        </VStack>
      </HStack>

      <iframe
        ref={iframeRef}
        title="QR print"
        style={{ display: "none" }}
        aria-hidden="true"
        tabIndex={-1}
      />

      <style>{`
        .qr-preview .qr-sheet {
          display: grid;
          gap: ${gapMm * 3}px;
          grid-template-columns: repeat(${columns}, 1fr);
          grid-template-rows: repeat(${rows}, 1fr);
          width: 380px;
          aspect-ratio: ${columns} / ${rows};
        }
        .qr-preview .qr-sheet img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          image-rendering: pixelated;
        }
      `}</style>
    </VStack>
  );
}
