"use client";

import type { Risk } from "@/domain/risk/risk.schema";
import type { DecisionMetrics } from "@/domain/decision/decision.types";
import { RiskRegisterRow } from "@/components/risk-register/RiskRegisterRow";

/** Column order: Risk ID | Title | Category | Owner | Pre | Post | Mitigation Movement | Status | [View / Edit] */
const TABLE_GRID_COLS = "56px minmax(0, 2.5fr) minmax(0, 1fr) minmax(0, 1fr) 100px 100px 100px minmax(0, 0.9fr)";
const TABLE_GRID_WITH_ACTION = `${TABLE_GRID_COLS} minmax(96px, 96px)`;

const addNewRowGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: TABLE_GRID_WITH_ACTION,
  padding: "10px 12px",
  borderBottom: "1px solid #eee",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

export type SortColumn =
  | "riskId"
  | "title"
  | "category"
  | "owner"
  | "preRating"
  | "postRating"
  | "mitigationMovement"
  | "status";

export type SortDirection = "asc" | "desc";

export type TableSortState = { column: SortColumn; direction: SortDirection } | null;

const SORT_HEADER_BASE =
  "text-left font-semibold hover:text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 rounded px-1 -mx-1 min-w-0";

function SortableHeader({
  label,
  column,
  sortState,
  onSort,
  title,
}: {
  label: string;
  column: SortColumn;
  sortState: TableSortState;
  onSort: (column: SortColumn) => void;
  title?: string;
}) {
  const active = sortState?.column === column;
  const dir = active ? sortState.direction : null;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={SORT_HEADER_BASE}
      title={title ?? `Sort by ${label}`}
    >
      {label}
      {dir === "asc" && <span className="ml-1 text-neutral-500" aria-hidden>↑</span>}
      {dir === "desc" && <span className="ml-1 text-neutral-500" aria-hidden>↓</span>}
    </button>
  );
}

/** @deprecated Use SortColumn + TableSortState instead */
export type SortByMitigationMovement = "asc" | "desc" | null;

export function RiskRegisterTable({
  risks,
  decisionById = {},
  scoreDeltaByRiskId = {},
  onRiskClick,
  onAddNewClick,
  sortState = null,
  onSortByColumn,
}: {
  risks: Risk[];
  decisionById?: Record<string, DecisionMetrics>;
  scoreDeltaByRiskId?: Record<string, number>;
  onRiskClick?: (risk: Risk) => void;
  onAddNewClick?: () => void;
  sortState?: TableSortState;
  onSortByColumn?: (column: SortColumn) => void;
}) {
  const showActions = Boolean(onRiskClick);
  const gridCols = showActions ? TABLE_GRID_WITH_ACTION : TABLE_GRID_COLS;
  const canSort = Boolean(onSortByColumn);

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden bg-[var(--background)]">
      <div
        className="grid gap-2.5 py-2.5 px-3 font-semibold border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 text-sm"
        style={{ gridTemplateColumns: gridCols }}
      >
        {canSort ? (
          <SortableHeader label="Risk ID" column="riskId" sortState={sortState} onSort={onSortByColumn!} />
        ) : (
          <div>Risk ID</div>
        )}
        {canSort ? (
          <SortableHeader label="Title" column="title" sortState={sortState} onSort={onSortByColumn!} />
        ) : (
          <div>Title</div>
        )}
        {canSort ? (
          <SortableHeader label="Category" column="category" sortState={sortState} onSort={onSortByColumn!} />
        ) : (
          <div>Category</div>
        )}
        {canSort ? (
          <SortableHeader label="Owner" column="owner" sortState={sortState} onSort={onSortByColumn!} />
        ) : (
          <div>Owner</div>
        )}
        {canSort ? (
          <SortableHeader label="Pre Rating" column="preRating" sortState={sortState} onSort={onSortByColumn!} />
        ) : (
          <div>Pre Rating</div>
        )}
        {canSort ? (
          <SortableHeader label="Post Rating" column="postRating" sortState={sortState} onSort={onSortByColumn!} />
        ) : (
          <div>Post Rating</div>
        )}
        {canSort ? (
          <SortableHeader
            label="Mitigation Movement"
            column="mitigationMovement"
            sortState={sortState}
            onSort={onSortByColumn!}
            title="Improving ↓, worsening ↑, stable →"
          />
        ) : (
          <div title="Improving ↓, worsening ↑, stable →">Mitigation Movement</div>
        )}
        {canSort ? (
          <SortableHeader label="Status" column="status" sortState={sortState} onSort={onSortByColumn!} />
        ) : (
          <div>Status</div>
        )}
        {showActions && <div />}
      </div>

      {risks.length === 0 && !onAddNewClick ? (
        <div className="p-3 opacity-80 text-[var(--foreground)]">No risks yet.</div>
      ) : (
        <>
          {risks.map((risk, index) => (
            <RiskRegisterRow
              key={risk.id}
              risk={risk}
              rowIndex={index}
              decision={decisionById[risk.id]}
              scoreDelta={scoreDeltaByRiskId[risk.id]}
              onRiskClick={onRiskClick}
            />
          ))}
          {onAddNewClick && showActions && (
            <div
              role="row"
              style={addNewRowGridStyle}
              className="border-t border-dashed border-neutral-300 dark:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-800/30 cursor-pointer hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50"
              onClick={onAddNewClick}
            >
              <span className="text-sm text-neutral-400 dark:text-neutral-500" aria-hidden>{"\u00A0"}</span>
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                Add new risk
              </span>
              <span className="text-sm text-neutral-400 dark:text-neutral-500" aria-hidden>{"\u00A0"}</span>
              <span className="text-sm text-neutral-400 dark:text-neutral-500" aria-hidden>{"\u00A0"}</span>
              <span className="text-sm text-neutral-400 dark:text-neutral-500" aria-hidden>{"\u00A0"}</span>
              <span className="text-sm text-neutral-400 dark:text-neutral-500" aria-hidden>{"\u00A0"}</span>
              <span className="text-sm text-neutral-400 dark:text-neutral-500" aria-hidden>{"\u00A0"}</span>
              <span className="text-sm text-neutral-400 dark:text-neutral-500" aria-hidden>{"\u00A0"}</span>
              <span className="text-sm text-neutral-400 dark:text-neutral-500" aria-hidden>{"\u00A0"}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}