export function fmtNumber(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR");
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return "-";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function statusBadgeColor(status: string | null | undefined): string {
  switch ((status ?? "").toUpperCase()) {
    case "BLOCK":
    case "END":
    case "FINISHED":
      return "bg-gray-200 text-gray-700";
    case "ONAIR":
    case "IN_SERVICE":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
