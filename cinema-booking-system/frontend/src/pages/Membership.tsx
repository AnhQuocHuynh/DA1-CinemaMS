import React from 'react';
import { Link } from 'react-router-dom';
import { SiteTopNav } from '../components/SiteTopNav';

import { useTranslation } from 'react-i18next';

export const Membership: React.FC = () => {
  const { t } = useTranslation();

  const perks = [
    t('membership.perk1', 'Priority seating windows'),
    t('membership.perk2', 'Zero booking fees'),
    t('membership.perk3', 'Members-only screenings'),
    t('membership.perk4', '25% off concessions'),
  ];
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <SiteTopNav activeLabel="Membership" showSearch={false} />
      <main className="pt-20 px-6 pb-12 max-w-[1100px] mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">{t('membership.title', 'Membership (Coming Soon)')}</h1>
          <p className="text-on-surface-variant mt-2">{t('membership.description', 'Unlock premium perks and priority access.')}</p>
        </header>

        <section className="rounded-3xl bg-inverse-surface text-inverse-on-surface p-10 md:p-14 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-3xl font-black leading-tight mb-4">{t('membership.elevate', 'Elevate your cinema experience')}</h2>
            <p className="text-inverse-on-surface mb-8">
              {t('membership.joinDesc', 'Join membership for priority seats, exclusive events, and zero booking fees.')}
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center px-6 py-3 rounded-lg bg-primary font-semibold hover:opacity-90"
            >
              {t('membership.start', 'Start Membership')}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {perks.map((perk) => (
              <div key={perk} className="rounded-xl border border-white/15 bg-surface-container-lowest/5 p-5">
                <p className="text-blue-300 text-sm font-bold mb-2">{t('membership.perkLabel', 'PERK')}</p>
                <p className="font-semibold">{perk}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
