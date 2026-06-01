"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

interface AdminTableProps {
  title: string;
  data: any[];
  columns: string[];
  sortable?: string[];
  onRowClick?: (row: any) => void;
  actions?: (row: any) => React.ReactNode;
  emptyState?: string;
}

export default function AdminTable({
  title,
  data,
  columns,
  sortable = [],
  onRowClick,
  actions,
  emptyState = "Nenhum dado disponível",
}: AdminTableProps) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (col: string) => {
    if (!sortable.includes(col)) return;
    if (sortBy === col) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortOrder("asc");
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortBy) return 0;
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="admin-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <h3 className="text-lg font-jaro font-bold text-zinc-100">{title}</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {data.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-zinc-400 text-sm">{emptyState}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="admin-table-head bg-zinc-950">
                {columns.map((col) => (
                  <th
                    key={col}
                    className={`px-6 py-3 text-left text-xs font-mono text-zinc-500 uppercase ${
                      sortable.includes(col) ? "cursor-pointer hover:text-zinc-300" : ""
                    }`}
                    onClick={() => handleSort(col)}
                  >
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {col}
                      {sortable.includes(col) && sortBy === col && (
                        sortOrder === "asc" ? (
                          <ChevronUp className="w-4 h-4 text-cyan-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-cyan-500" />
                        )
                      )}
                    </div>
                  </th>
                ))}
                {actions && <th className="px-6 py-3 text-right text-xs font-mono text-zinc-500">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, i) => (
                <tr
                  key={i}
                  className={`admin-table-row ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={col} className="px-6 py-4 text-sm text-zinc-100 font-mono whitespace-nowrap">
                      {renderCell(row[col])}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function renderCell(value: any) {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return value.toLocaleString("pt-BR");
  if (value === null || value === undefined) return "—";
  return String(value);
}
