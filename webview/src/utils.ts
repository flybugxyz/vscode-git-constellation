export function formatDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return '';
  const timestamp = parseInt(dateStr);
  if (isNaN(timestamp)) return dateStr;
  try {
    return new Date(timestamp * 1000).toLocaleString([], options);
  } catch {
    return dateStr;
  }
}
