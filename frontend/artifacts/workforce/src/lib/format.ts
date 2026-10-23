export function fmtNum(n: number | string | undefined | null): string {
  if (n === undefined || n === null) return "0";
  const num = typeof n === "number" ? n : Number(n);
  return Number.isNaN(num) ? String(n) : num.toLocaleString();
}

export function fmtPct(n: number | string | undefined | null): string {
  if (n === undefined || n === null) return "0%";
  const num = typeof n === "number" ? n : Number(n);
  return Number.isNaN(num) ? "0%" : `${num.toFixed(1)}%`;
}

export function fmtDate(d: string | Date | undefined | null): string {
  if (!d) return "";
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("en-MY", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(d);
  }
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
