type EmptyStateProps = {
  message: string;
  className?: string;
};

/**
 * Simple empty state message for cards and panels.
 */
export function EmptyState({ message, className = "" }: EmptyStateProps) {
  return (
    <p className={`text-sm text-neutral-500 dark:text-neutral-400 m-0 ${className}`.trim()}>
      {message}
    </p>
  );
}
