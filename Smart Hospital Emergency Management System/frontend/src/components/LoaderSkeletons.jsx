import React from 'react';

// Single dashboard analytic card skeleton
export const CardSkeleton = () => {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800"></div>
        <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
      </div>
      <div className="mt-4">
        <div className="h-8 w-16 rounded bg-slate-200 dark:bg-slate-800"></div>
        <div className="mt-2 h-3 w-32 rounded bg-slate-100 dark:bg-slate-800/60"></div>
      </div>
    </div>
  );
};

// Table loader skeleton
export const TableSkeleton = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="w-full rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 animate-pulse">
      <div className="flex h-10 w-full items-center justify-between border-b border-slate-50 dark:border-slate-800 mb-4 px-2">
        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-800"></div>
        <div className="h-8 w-24 rounded bg-slate-200 dark:bg-slate-800"></div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex items-center gap-4 px-2 py-3 border-b border-slate-50/50 dark:border-slate-800/40 last:border-0">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                className={`h-4 rounded bg-slate-200 dark:bg-slate-800 ${
                  cIdx === 0 ? 'w-1/4' : cIdx === 1 ? 'w-1/3' : 'w-1/6'
                }`}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// Map container skeleton placeholder
export const MapSkeleton = () => {
  return (
    <div className="relative flex h-full w-full items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800">
          <span className="text-2xl text-slate-400">🗺️</span>
        </div>
        <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-800"></div>
        <div className="h-3 w-48 rounded bg-slate-100 dark:bg-slate-800/60"></div>
      </div>
    </div>
  );
};
