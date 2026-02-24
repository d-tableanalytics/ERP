const DataTable = ({ columns, header, data, sortConfig, onSort, onAction, onStatusChange }) => {
  const sortIcon = (key) => {
    if (sortConfig?.key !== key)
      return <span className="text-slate-400 text-[10px] ml-1">↕</span>;

    return sortConfig.direction === "asc" ? (
      <span className="text-primary text-[10px] ml-1">↑</span>
    ) : (
      <span className="text-primary text-[10px] ml-1">↓</span>
    );
  };

  return (
    <div className="bg-bg-card mt-6 border border-border-main rounded-2xl shadow-sm">
      {/* Scroll Container */}
      <div className="overflow-x-auto overflow-y-auto max-h-[500px] scroll-smooth">
        <table className="min-w-[1000px] w-full text-sm border-collapse">
          {/* ---------- HEADER ---------- */}
          <thead className="sticky top-0 z-10 bg-bg-main">
            <tr className="text-text-muted text-[10px] uppercase tracking-wider border-b border-border-main">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort && onSort(col.key)}
                  className={`px-5 py-4 text-left select-none whitespace-nowrap
                    ${onSort ? "cursor-pointer hover:bg-bg-main/70" : ""}`}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {onSort && sortIcon(col.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* ---------- BODY ---------- */}
          <tbody className="divide-y divide-border-main">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-20 text-text-muted font-bold"
                >
                  No data found
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={idx} className="hover:bg-bg-main/20 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-5 py-4 whitespace-nowrap">
                      {col.key === "status" ? (
                        <select
                          value={row[col.key]}
                          onChange={(e) => onStatusChange && onStatusChange(row, e.target.value)}
                          className={`px-2 py-1 text-xs font-semibold rounded-md text-white border-none cursor-pointer outline-none
                            ${row[col.key] === "NOT DONE"
                              ? "bg-gray-700"
                              : row[col.key] === "DONE"
                                ? "bg-green-600"
                                : "bg-slate-600"
                            }`}
                        >
                          <option value="NOT DONE" className="bg-bg-card text-text-main">NOT DONE</option>
                          <option value="DONE" className="bg-bg-card text-text-main">DONE</option>
                        </select>
                      ) : col.key === "action" ? (
                        <button
                          onClick={() => onAction && onAction(row, header)}
                          className="px-3 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 transition"
                        >
                          {row[col.key]}
                        </button>
                      ) : (
                        (row[col.key] ?? "-")
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
