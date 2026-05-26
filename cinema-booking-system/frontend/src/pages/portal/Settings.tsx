import React from 'react';
import { Link } from 'react-router-dom';
import { SiteTopNav } from '../../components/SiteTopNav';

export const Settings: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <SiteTopNav activeLabel="Settings" showSearch={false} />
      <main className="pt-24 px-6 pb-16 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-on-surface">Settings</h1>
          <p className="text-on-surface-variant mt-2">Manage your account preferences.</p>
        </div>

        <section className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
          <h2 className="text-lg font-semibold text-on-surface mb-2">Security</h2>
          <p className="text-sm text-on-surface-variant mb-4">
            Reset your password if you think your account has been compromised.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all"
          >
            Reset Password
          </Link>
        </section>
      </main>
    </div>
  );
};
