import Link from "next/link";
import { dashboardStats, listCategories } from "@/lib/queries";
import { fmtNumber } from "@/lib/format";

export default async function CategoriesPage() {
  const categories = listCategories();
  const stats = dashboardStats();
  const byId = new Map(stats.byCategory.map((c) => [c.category_id, c]));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">카테고리</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((c) => {
          const s = byId.get(c.category_id);
          return (
            <Link
              key={c.category_id}
              href={`/categories/${encodeURIComponent(c.category_id)}`}
              className="bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition"
            >
              <div className="flex items-center gap-3">
                {c.icon_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.icon_url}
                    alt=""
                    className="w-10 h-10"
                  />
                )}
                <div className="flex-1">
                  <div className="font-bold text-lg">{c.name}</div>
                  <div className="text-xs text-slate-500">
                    {c.category_id}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 text-sm">
                <div>
                  <div className="text-slate-500 text-xs">방송</div>
                  <div className="font-semibold tabular-nums">
                    {fmtNumber(s?.broadcast_count ?? 0)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">댓글</div>
                  <div className="font-semibold tabular-nums">
                    {fmtNumber(s?.comment_count ?? 0)}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
