"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasRememberedScroll, requestRestore } from "./scrollMemory";

/**
 * "Back to the gallery" on /work/[slug]: a[data-back]. When the visitor came
 * from the mosaic, it returns to `/` at the stored scroll position (restored by
 * WorkClient before paint). Otherwise, and without JS, it is a plain link to
 * /#work.
 */
export function BackLink({ label, className = "" }: { label: string; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href="/#work"
      data-back
      className={className}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (!hasRememberedScroll()) return;
        e.preventDefault();
        requestRestore();
        router.push("/", { scroll: false });
      }}
    >
      <ArrowLeft aria-hidden size={18} strokeWidth={1.75} strokeLinecap="round" />
      <span>{label}</span>
    </Link>
  );
}
