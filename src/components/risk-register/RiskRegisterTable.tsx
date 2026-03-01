"use client";

import { useState, useRef, useEffect } from "react";
import type { Risk, RiskLevel } from "@/domain/risk/risk.schema";
import type { DecisionMetrics } from "@/domain/decision/decision.types";
import { RiskRegisterRow } from "@/components/risk-register/RiskRegisterRow";

const LEVEL_LETTER: Record<RiskLevel, string> = { low: "L", medium: "M", high: "H", extreme: "E" };
function levelToLetter(level: RiskLevel): string {
  return LEVEL_LETTER[level] ?? "L";
}
function getMovement(preScore: number, postScore: number): "↑" | "↓" | "→" {
  if (postScore > preScore) return "↑";
  if (postScore < preScore) return "↓";
  return "→";
}
function getPostDisplay(risk: Risk): string {
  return risk.mitigation?.trim() ? levelToLetter(risk.residualRating.level) : "N/A";
}

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

export type ColumnFilters = Partial<Record<SortColumn, string[]>>;

/** Rating letter order: H, M, L (E first if present). */
const RATING_ORDER = ["E", "H", "M", "L"];
function sortRatingOptions(options: string[]): string[] {
  const order = new Map(RATING_ORDER.map((v, i) => [v, i]));
  return [...options].sort((a, b) => {
    const ia = order.has(a) ? order.get(a)! : 999;
    const ib = order.has(b) ? order.get(b)! : 999;
    return ia - ib;
  });
}

function getDistinctValues(risks: Risk[], column: SortColumn): string[] {
  const set = new Set<string>();
  for (const r of risks) {
    switch (column) {
      case "riskId":
        if (r.riskNumber != null) set.add(String(r.riskNumber).padStart(3, "0"));
        break;
      case "title":
        if (r.title?.trim()) set.add(r.title.trim());
        break;
      case "category":
        set.add(r.category);
        break;
      case "owner":
        set.add(r.owner ?? "—");
        break;
      case "preRating":
        set.add(levelToLetter(r.inherentRating.level));
        break;
      case "postRating":
        set.add(getPostDisplay(r));
        break;
      case "mitigationMovement":
        set.add(getMovement(r.inherentRating.score, r.residualRating.score));
        break;
      case "status":
        set.add(r.status);
        break;
    }
  }
  const arr = Array.from(set);
  if (column === "preRating" || column === "postRating") {
    const ratingLetters = arr.filter((x) => RATING_ORDER.includes(x));
    const other = arr.filter((x) => !RATING_ORDER.includes(x)); // e.g. "N/A" for postRating
    return [...sortRatingOptions(ratingLetters), ...other.sort((a, b) => a.localeCompare(b))];
  }
  if (column === "mitigationMovement") {
    const movementOrder = ["↑", "→", "↓"]; // up (worsening), same (stable), down (improving)
    const order = new Map(movementOrder.map((v, i) => [v, i]));
    return [...arr].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
  }
  return arr.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function FilterIcon({ active }: { active?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={active ? "text-neutral-800 dark:text-neutral-200" : "text-neutral-500 dark:text-neutral-400"}
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function FilterPopover({
  column,
  options,
  selected,
  onSelect,
  onClose,
  anchorRef,
}: {
  column: SortColumn;
  options: string[];
  selected: string[];
  onSelect: (values: string[]) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        anchorRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      )
        return;
      onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, anchorRef]);

  useEffect(() => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  }, [column]);

  const q = searchQuery.trim().toLowerCase();
  const filteredOptions = q
    ? options.filter((opt) => opt.toLowerCase().includes(q))
    : options;

  const toggle = (value: string) => {
    if (selected.includes(value)) onSelect(selected.filter((s) => s !== value));
    else onSelect([...selected, value]);
  };
  const selectAll = () => onSelect([...options]);
  const clearAll = () => onSelect([]);

  return (
    <div
      ref={popoverRef}
      className="absolute left-0 top-full z-50 mt-1 min-w-[140px] max-w-[220px] rounded-md border border-neutral-200 dark:border-neutral-600 bg-[var(--background)] py-2 shadow-lg"
      role="dialog"
      aria-label={`Filter by ${column}`}
    >
      <div className="px-2 pb-2 border-b border-neutral-100 dark:border-neutral-700 mb-2">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="w-full h-8 px-2 rounded border border-neutral-300 dark:border-neutral-600 bg-[var(--background)] text-[var(--foreground)] text-sm placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
          aria-label="Search options"
        />
      </div>
      <div className="max-h-48 overflow-y-auto px-2">
        {filteredOptions.length === 0 ? (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 py-1">
            {options.length === 0 ? "No options" : "No matches"}
          </p>
        ) : (
          filteredOptions.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 py-1 text-sm cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded px-1"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-neutral-300 dark:border-neutral-600"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))
        )}
      </div>
      <div className="flex gap-1 pt-2 px-2 border-t border-neutral-100 dark:border-neutral-700 mt-1">
        <button
          type="button"
          onClick={selectAll}
          className="text-xs text-neutral-600 dark:text-neutral-400 hover:underline"
        >
          All
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-neutral-600 dark:text-neutral-400 hover:underline"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function HeaderCell({
  children,
  canFilter,
  column,
  risks,
  risksForFilterOptions,
  columnFilters,
  onColumnFilterChange,
  openFilterColumn,
  setOpenFilterColumn,
}: {
  children: React.ReactNode;
  canFilter: boolean;
  column: SortColumn;
  risks: Risk[];
  risksForFilterOptions?: Risk[];
  columnFilters: ColumnFilters;
  onColumnFilterChange?: (column: SortColumn, values: string[]) => void;
  openFilterColumn: SortColumn | null;
  setOpenFilterColumn: (col: SortColumn | null) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const optionsSource = risksForFilterOptions ?? risks;
  const options = getDistinctValues(optionsSource, column);
  const selected = columnFilters[column] ?? [];

  return (
    <div className="relative flex items-center gap-1 min-w-0">
      {children}
      {canFilter && onColumnFilterChange && (
        <div className="shrink-0">
          <button
            ref={btnRef}
            type="button"
            onClick={() => setOpenFilterColumn(openFilterColumn === column ? null : column)}
            className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            title={`Filter ${column}`}
            aria-label={`Filter by ${column}`}
            aria-expanded={openFilterColumn === column}
          >
            <FilterIcon active={selected.length > 0} />
          </button>
        </div>
      )}
      {canFilter && onColumnFilterChange && openFilterColumn === column && (
        <FilterPopover
          column={column}
          options={options}
          selected={selected}
          onSelect={(values) => onColumnFilterChange(column, values)}
          onClose={() => setOpenFilterColumn(null)}
          anchorRef={btnRef}
        />
      )}
    </div>
  );
}

export function RiskRegisterTable({
  risks,
  risksForFilterOptions,
  decisionById = {},
  scoreDeltaByRiskId = {},
  onRiskClick,
  onAddNewClick,
  sortState = null,
  onSortByColumn,
  columnFilters = {},
  onColumnFilterChange,
}: {
  risks: Risk[];
  risksForFilterOptions?: Risk[];
  decisionById?: Record<string, DecisionMetrics>;
  scoreDeltaByRiskId?: Record<string, number>;
  onRiskClick?: (risk: Risk) => void;
  onAddNewClick?: () => void;
  sortState?: TableSortState;
  onSortByColumn?: (column: SortColumn) => void;
  columnFilters?: ColumnFilters;
  onColumnFilterChange?: (column: SortColumn, values: string[]) => void;
}) {
  const showActions = Boolean(onRiskClick);
  const gridCols = showActions ? TABLE_GRID_WITH_ACTION : TABLE_GRID_COLS;
  const canSort = Boolean(onSortByColumn);
  const canFilter = Boolean(onColumnFilterChange);
  const [openFilterColumn, setOpenFilterColumn] = useState<SortColumn | null>(null);
  const filterOptionsRisks = risksForFilterOptions ?? risks;

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden bg-[var(--background)]">
      <div
        className="grid gap-2.5 py-2.5 px-3 font-semibold border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 text-sm"
        style={{ gridTemplateColumns: gridCols }}
      >
        <HeaderCell
          canFilter={canFilter}
          column="riskId"
          risks={risks}
          risksForFilterOptions={filterOptionsRisks}
          columnFilters={columnFilters}
          onColumnFilterChange={onColumnFilterChange}
          openFilterColumn={openFilterColumn}
          setOpenFilterColumn={setOpenFilterColumn}
        >
          {canSort ? (
            <SortableHeader label="Risk ID" column="riskId" sortState={sortState} onSort={onSortByColumn!} />
          ) : (
            <div>Risk ID</div>
          )}
        </HeaderCell>
        <HeaderCell
          canFilter={canFilter}
          column="title"
          risks={risks}
          risksForFilterOptions={filterOptionsRisks}
          columnFilters={columnFilters}
          onColumnFilterChange={onColumnFilterChange}
          openFilterColumn={openFilterColumn}
          setOpenFilterColumn={setOpenFilterColumn}
        >
          {canSort ? (
            <SortableHeader label="Title" column="title" sortState={sortState} onSort={onSortByColumn!} />
          ) : (
            <div>Title</div>
          )}
        </HeaderCell>
        <HeaderCell
          canFilter={canFilter}
          column="category"
          risks={risks}
          risksForFilterOptions={filterOptionsRisks}
          columnFilters={columnFilters}
          onColumnFilterChange={onColumnFilterChange}
          openFilterColumn={openFilterColumn}
          setOpenFilterColumn={setOpenFilterColumn}
        >
          {canSort ? (
            <SortableHeader label="Category" column="category" sortState={sortState} onSort={onSortByColumn!} />
          ) : (
            <div>Category</div>
          )}
        </HeaderCell>
        <HeaderCell
          canFilter={canFilter}
          column="owner"
          risks={risks}
          risksForFilterOptions={filterOptionsRisks}
          columnFilters={columnFilters}
          onColumnFilterChange={onColumnFilterChange}
          openFilterColumn={openFilterColumn}
          setOpenFilterColumn={setOpenFilterColumn}
        >
          {canSort ? (
            <SortableHeader label="Owner" column="owner" sortState={sortState} onSort={onSortByColumn!} />
          ) : (
            <div>Owner</div>
          )}
        </HeaderCell>
        <HeaderCell
          canFilter={canFilter}
          column="preRating"
          risks={risks}
          risksForFilterOptions={filterOptionsRisks}
          columnFilters={columnFilters}
          onColumnFilterChange={onColumnFilterChange}
          openFilterColumn={openFilterColumn}
          setOpenFilterColumn={setOpenFilterColumn}
        >
          {canSort ? (
            <SortableHeader label="Pre Rating" column="preRating" sortState={sortState} onSort={onSortByColumn!} />
          ) : (
            <div>Pre Rating</div>
          )}
        </HeaderCell>
        <HeaderCell
          canFilter={canFilter}
          column="postRating"
          risks={risks}
          risksForFilterOptions={filterOptionsRisks}
          columnFilters={columnFilters}
          onColumnFilterChange={onColumnFilterChange}
          openFilterColumn={openFilterColumn}
          setOpenFilterColumn={setOpenFilterColumn}
        >
          {canSort ? (
            <SortableHeader label="Post Rating" column="postRating" sortState={sortState} onSort={onSortByColumn!} />
          ) : (
            <div>Post Rating</div>
          )}
        </HeaderCell>
        <HeaderCell
          canFilter={canFilter}
          column="mitigationMovement"
          risks={risks}
          risksForFilterOptions={filterOptionsRisks}
          columnFilters={columnFilters}
          onColumnFilterChange={onColumnFilterChange}
          openFilterColumn={openFilterColumn}
          setOpenFilterColumn={setOpenFilterColumn}
        >
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
        </HeaderCell>
        <HeaderCell
          canFilter={canFilter}
          column="status"
          risks={risks}
          risksForFilterOptions={filterOptionsRisks}
          columnFilters={columnFilters}
          onColumnFilterChange={onColumnFilterChange}
          openFilterColumn={openFilterColumn}
          setOpenFilterColumn={setOpenFilterColumn}
        >
          {canSort ? (
            <SortableHeader label="Status" column="status" sortState={sortState} onSort={onSortByColumn!} />
          ) : (
            <div>Status</div>
          )}
        </HeaderCell>
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