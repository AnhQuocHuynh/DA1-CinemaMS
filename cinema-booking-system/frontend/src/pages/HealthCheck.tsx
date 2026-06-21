import React, { useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export const HealthCheck: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'up' | 'down' | 'error'>('idle');
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string>(`${API_BASE_URL}/health`);

  const pingHealth = async (path: string) => {
    const nextTarget = `${API_BASE_URL}${path}`;
    setLoading(true);
    setStatus('idle');
    setPayload(null);
    setError(null);
    setTarget(nextTarget);

    try {
      const response = await fetch(nextTarget);
      const data = await response.json().catch(() => null);
      setPayload(data);
      setStatus(response.ok ? 'up' : 'down');
      if (!response.ok) {
        setError(`Health check failed (${response.status})`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus('error');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Backend Monitor</p>
          <h1 className="mt-3 text-3xl font-semibold">Health Ping</h1>
          <p className="mt-2 text-sm text-slate-400">
            Ping the backend and report database + cache status.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => pingHealth('/health')}
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Checking...' : 'Ping /health'}
          </button>
          <button
            onClick={() => pingHealth('/health/requests')}
            disabled={loading}
            className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Checking...' : 'Ping /health/requests'}
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                status === 'up'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : status === 'down'
                    ? 'bg-amber-500/20 text-amber-300'
                    : status === 'error'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-slate-800 text-slate-300'
              }`}
            >
              {status === 'idle' ? 'IDLE' : status.toUpperCase()}
            </span>
          </div>

          {error && <p className="mt-3 text-rose-300">{error}</p>}

          <div className="mt-4 max-h-56 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-200">
            <pre className="whitespace-pre-wrap break-words">
              {payload ? JSON.stringify(payload, null, 2) : 'No data yet.'}
            </pre>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Target: {target}
          </p>
        </div>
      </div>
    </div>
  );
};
