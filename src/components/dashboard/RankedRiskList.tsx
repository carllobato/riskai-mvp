import type { ReactNode } from "react";

export type RankedRiskListItem<T> = T & { id: string };

type RankedRiskListProps<T> = {
  items: RankedRiskListItem<T>[];
  renderRow: (item: RankedRiskListItem<T>, rank: number) => ReactNode;
  emptyMessage?: string;
};

/**
 * Reusable ranked list: shows items with rank number and custom row content.
 */
export function RankedRiskList<T>({
  items,
  renderRow,
  emptyMessage = "No items",
}: RankedRiskListProps<T>) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400 m-0">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="list-none m-0 p-0 space-y-2">
      {items.map((item, index) => (
        <li
          key={item.id}
          className="flex items-center gap-3 py-2 px-0 border-b border-neutral-100 dark:border-neutral-700/50 last:border-b-0"
        >
          <span
            className="shrink-0 w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-600 text-neutral-600 dark:text-neutral-300 text-xs font-medium flex items-center justify-center"
            aria-hidden
          >
            {index + 1}
          </span>
          {renderRow(item, index + 1)}
        </li>
      ))}
    </ul>
  );
}
