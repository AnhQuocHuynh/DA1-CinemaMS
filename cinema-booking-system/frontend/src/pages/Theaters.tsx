import React from 'react';
import { SiteTopNav } from '../components/SiteTopNav';

const theaters = [
  {
    id: 'cgv-hung-vuong',
    name: 'CGV Hung Vuong Plaza',
    city: 'Ho Chi Minh City',
    description: 'Premium rooms with IMAX and Dolby Atmos tuning.',
  },
  {
    id: 'beta-thu-duc',
    name: 'Beta Thu Duc',
    city: 'Ho Chi Minh City',
    description: 'Boutique halls with recliner seating and private pods.',
  },
];

export const Theaters: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SiteTopNav activeLabel="Theaters" showSearch={false} />
      <main className="pt-20 px-6 pb-12 max-w-[1200px] mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Theaters</h1>
          <p className="text-slate-600 mt-2">Find the best halls and formats for your next show.</p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {theaters.map((theater) => (
            <article
              key={theater.id}
              className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{theater.name}</h2>
                  <p className="text-sm text-slate-500">{theater.city}</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">Open</span>
              </div>
              <p className="text-sm text-slate-600">{theater.description}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
};
