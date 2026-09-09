"use client";

/** چیپ دسته‌بندی — ناوبری فیلتر دسته در کاتالوگ و شبکه دسته‌ها در صفحه اصلی. */
export function CategoryChips({
  categories,
  active,
  onSelect,
}: {
  categories: { slug: string; name: string; icon?: string | null }[];
  active: string | null;
  onSelect: (slug: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
          !active
            ? "border border-brand-500/60 bg-brand-500/15 text-brand-500"
            : "border border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-200"
        }`}
      >
        همه دسته‌ها
      </button>
      {categories.map((c) => (
        <button
          key={c.slug}
          onClick={() => onSelect(c.slug)}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            active === c.slug
              ? "border border-brand-500/60 bg-brand-500/15 text-brand-500"
              : "border border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-700 hover:text-gray-200"
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
