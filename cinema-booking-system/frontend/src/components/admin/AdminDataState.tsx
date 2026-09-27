import React from 'react';
import { RefreshCw } from 'lucide-react';

// ── Skeleton pulse row ────────────────────────────────────────────────────────
const SkeletonRow = ({ cols = 4 }: { cols?: number }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-6 py-4">
        <div className="h-3 bg-slate-200 rounded animate-pulse" style={{ width: `${60 + (i * 13) % 35}%` }} />
      </td>
    ))}
  </tr>
);

const SkeletonCard = () => (
  <div className="bg-surface-container-lowest p-6 rounded-xl animate-pulse space-y-3">
    <div className="h-2.5 bg-slate-200 rounded w-1/3" />
    <div className="h-8 bg-slate-200 rounded w-1/2" />
    <div className="h-2 bg-slate-200 rounded w-2/3" />
  </div>
);

// ── Loading skeleton for table-based pages ─────────────────────────────────
export const AdminTableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm animate-pulse">
    {/* fake header */}
    <div className="flex gap-6 px-6 py-4 bg-surface-container-low border-b border-slate-100">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="h-2 bg-slate-200 rounded" style={{ width: `${50 + (i * 17) % 40}px` }} />
      ))}
    </div>
    <table className="w-full">
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} cols={cols} />
        ))}
      </tbody>
    </table>
  </div>
);

// ── Loading skeleton for card/grid pages ───────────────────────────────────
export const AdminCardSkeleton = ({ cards = 3 }: { cards?: number }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
    {Array.from({ length: cards }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

// ── Empty + Retry state ────────────────────────────────────────────────────
interface AdminEmptyStateProps {
  onRetry: () => void;
  message?: string;
  isRetrying?: boolean;
}

export const AdminEmptyState: React.FC<AdminEmptyStateProps> = ({
  onRetry,
  message = 'No data available.',
  isRetrying = false,
}) => (
  <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
    <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center">
      <RefreshCw className={`w-7 h-7 text-slate-400 ${isRetrying ? 'animate-spin' : ''}`} />
    </div>
    <div>
      <p className="text-sm font-semibold text-on-surface">{message}</p>
      <p className="text-xs text-on-surface-variant mt-1">The service may be temporarily unavailable.</p>
    </div>
    <button
      id="admin-retry-btn"
      onClick={onRetry}
      disabled={isRetrying}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg
                 hover:brightness-110 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-primary/20"
    >
      <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
      {isRetrying ? 'Retrying…' : 'Retry'}
    </button>
  </div>
);

// ── Convenience wrapper: handles all three states (loading / empty / content)
interface AdminDataStateProps {
  isLoading: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  isRetrying?: boolean;
  emptyMessage?: string;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}

export const AdminDataState: React.FC<AdminDataStateProps> = ({
  isLoading,
  isEmpty,
  onRetry,
  isRetrying = false,
  emptyMessage,
  skeleton,
  children,
}) => {
  if (isLoading) return <>{skeleton ?? <AdminTableSkeleton />}</>;
  if (isEmpty) return <AdminEmptyState onRetry={onRetry} message={emptyMessage} isRetrying={isRetrying} />;
  return <>{children}</>;
};
