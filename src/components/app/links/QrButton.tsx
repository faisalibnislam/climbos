"use client";

import { Download, QrCode } from "@/components/icons"
import { useMemo, useState } from "react";
import { qrSvg } from "@shared/links/qr";
import { Button, Dialog, DialogContent, DialogFooter, DialogTrigger, toast } from "@/components/ui";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** A QR code for a short link (our own encoder), to show and download as SVG or PNG. */
export function QrButton({ url, label }: { url: string; label: string }) {
  const [open, setOpen] = useState(false);
  const svg = useMemo(() => (open ? qrSvg(url, { size: 240, title: `QR code for ${label}` }) : ""), [open, url, label]);
  const file = `qr-${url.split("/").pop() ?? "link"}`;
  const png = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1024;
      const c = canvas.getContext("2d");
      if (!c) return;
      c.imageSmoothingEnabled = false;
      c.drawImage(img, 0, 0, 1024, 1024);
      canvas.toBlob((b) => (b ? save(b, `${file}.png`) : toast({ tone: "danger", title: "Couldn't make the PNG. Try the SVG." })), "image/png");
    };
    img.onerror = () => toast({ tone: "danger", title: "Couldn't make the PNG. Try the SVG." });
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" aria-label={`QR code for ${label}`}>
          <QrCode aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent title="QR code" description={url.replace(/^https?:\/\//, "")}>
        {/* Our own encoder's SVG: only rects and a path. */}
        <div className="mx-auto rounded-lg border border-line bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
        <DialogFooter>
          <Button variant="secondary" onClick={() => save(new Blob([svg], { type: "image/svg+xml" }), `${file}.svg`)}>
            <Download aria-hidden /> SVG
          </Button>
          <Button onClick={png}>
            <Download aria-hidden /> PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
