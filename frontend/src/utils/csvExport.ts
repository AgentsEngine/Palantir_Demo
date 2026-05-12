/**
 * Export table data to CSV file.
 */
export function exportCSV(columns: { title?: string; dataIndex?: string; key?: string }[], data: any[], filename: string) {
  const headers = columns.filter(c => c.dataIndex).map(c => c.title || c.dataIndex || '');
  const keys = columns.filter(c => c.dataIndex).map(c => c.dataIndex!);

  const escapeCell = (v: any): string => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = data.map(row => keys.map(k => escapeCell(row[k])).join(','));
  const csv = '﻿' + [headers.map(escapeCell).join(','), ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
