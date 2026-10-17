"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { buttonClasses } from "@/components/ui/button-styles";
import { CTA } from "./content";

/** Mobile menu: a right-side Sheet with nav links and the two primary actions. */
export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Menu"
        trigger={<IconButton aria-label="Open menu" icon={<Menu />} size="lg" className="-mr-2" />}
      >
        <nav aria-label="Mobile">
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={buttonClasses({ variant: "ghost", size: "lg", className: "w-full justify-start px-2" })}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-6 flex flex-col gap-2 border-t border-line pt-6">
          <Link href={CTA.getStarted.href} onClick={() => setOpen(false)} className={buttonClasses({ size: "lg" })}>
            {CTA.getStarted.label}
          </Link>
          <Link href="/sign-in" onClick={() => setOpen(false)} className={buttonClasses({ variant: "secondary", size: "lg" })}>
            Sign in
          </Link>
          <Link href={CTA.demo.href} onClick={() => setOpen(false)} className={buttonClasses({ variant: "ghost", size: "lg" })}>
            {CTA.demo.label}
          </Link>
        </div>
      </Sheet>
    </div>
  );
}
