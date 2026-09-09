"use client";

/**
 * گالری محصول: تصویر اصلی + تصاویر کوچک قابل تعویض + زوم ساده CSS روی هاور.
 * وقتی عکسی نیست، جای‌نگهدار آیکون نمایش می‌دهیم.
 */

import { useState } from "react";

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? null;

  return (
    <div className="space-y-3.5">
      <div className="group relative h-80 sm:h-96 overflow-hidden rounded-3xl border border-gray-200 bg-gray-900 shadow-inner cursor-crosshair">
        {main ? (
          <img
            src={main}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-135"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2">
            <svg className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-xs">تصویری برای این قطعه ثبت نشده است</span>
          </div>
        )}
        {main && (
          <span className="absolute bottom-3 right-3 z-10 pointer-events-none bg-gray-950/80 text-white text-[10px] px-3 py-1.5 rounded-xl backdrop-blur-md border border-gray-700">
            برای زوم، ماوس را روی تصویر ببرید
          </span>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`تصویر ${i + 1}`}
              className={`h-20 rounded-2xl overflow-hidden transition relative ${
                i === active ? "border-2 border-brand-500 shadow-2xs" : "border border-gray-200 hover:border-gray-400"
              }`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
