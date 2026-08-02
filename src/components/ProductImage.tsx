"use client";

import { useState } from "react";

/**
 * Product thumbnail.
 *
 * Deliberately a plain <img>, not next/image. Vercel's free tier meters
 * optimised source images, and an evaluator browsing the catalogue could exhaust
 * that quota mid-demo. These are already flat 400x400 tiles — there is nothing
 * for the optimiser to win. (EDGE_CASES H1)
 *
 * On load failure the image is replaced by a neutral initial rather than a
 * broken-image icon. (EDGE_CASES A2)
 */
export default function ProductImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--color-surface-sunken)] text-[var(--color-ink-faint)] ${className}`}
        aria-label={alt}
        role="img"
      >
        <span className="text-lg font-semibold">
          {alt.trim().charAt(0).toUpperCase() || "?"}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-contain ${className}`}
    />
  );
}
