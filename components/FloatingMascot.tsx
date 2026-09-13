"use client";

import Image from "next/image";

/**
 * Purely decorative - the float animation lives on this wrapper (transform:
 * translateY) and the hover scale lives on the image itself, so the two
 * transforms don't fight over the same element.
 */
export function FloatingMascot() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed right-4 bottom-4 z-20 sm:right-6 sm:bottom-6"
    >
      <div className="pointer-events-auto animate-float">
        <Image
          src="/brand/mascot/Arrangy.png"
          alt=""
          width={180}
          height={180}
          className="size-28 cursor-default select-none drop-shadow-xl transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-125 sm:size-36 lg:size-40"
        />
      </div>
    </div>
  );
}
