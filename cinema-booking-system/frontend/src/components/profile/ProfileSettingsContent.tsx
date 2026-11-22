import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { userService, UserProfile } from '../../services/userService';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

export const ProfileSettingsContent: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await userService.getMyProfile();
        setProfile(data);
        if (data) {
          setPhone(data.phone || '');
          setGender(data.gender || '');
          setDob(data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().split('T')[0] : '');
        }
      } catch (err: any) {
        addToast(err?.message || t('profileSettings.loadError', 'Failed to load profile.'), 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [addToast]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await userService.updateMyProfile({
        phone: phone || undefined,
        gender: gender || undefined,
        dateOfBirth: dob ? new Date(dob).toISOString() : undefined,
      });
      addToast(t('profileSettings.updateSuccess', 'Profile updated successfully.'), 'success');
      
      // refresh
      const data = await userService.getMyProfile();
      setProfile(data);
    } catch (err: any) {
      addToast(err?.message || t('profileSettings.updateError', 'Failed to update profile.'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-10 text-on-surface-variant">{t('profileSettings.loading', 'Loading profile...')}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
        <h2 className="text-lg font-semibold text-on-surface mb-6">{t('profileSettings.title', 'Profile Information')}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1">{t('profileSettings.fullName', 'Full Name')}</label>
            <input 
              type="text" 
              value={profile?.fullName || ''} 
              disabled 
              className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-on-surface-variant cursor-not-allowed"
            />
            <p className="text-xs text-on-surface-variant mt-1">{t('profileSettings.nameNotice', 'Name cannot be changed here.')}</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1">{t('profileSettings.email', 'Email')}</label>
            <input 
              type="email" 
              value={profile?.email || ''} 
              disabled 
              className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-on-surface-variant cursor-not-allowed"
            />
            <p className="text-xs text-on-surface-variant mt-1">{t('profileSettings.emailNotice', 'Email is managed by the identity provider.')}</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1">{t('profileSettings.phone', 'Phone Number')}</label>
              <input 
                type="tel" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                className="w-full bg-surface-container-lowest border border-outline rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-on-surface-variant mb-1">{t('profileSettings.gender', 'Gender')}</label>
              <select 
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none transition-shadow"
              >
                <option value="">{t('profileSettings.genderPreferNotToSay', 'Prefer not to say')}</option>
                <option value="MALE">{t('profileSettings.genderMale', 'Male')}</option>
                <option value="FEMALE">{t('profileSettings.genderFemale', 'Female')}</option>
                <option value="OTHER">{t('profileSettings.genderOther', 'Other')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-1">{t('profileSettings.dob', 'Date of Birth')}</label>
            <input 
              type="date" 
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full md:w-1/2 bg-surface-container-lowest border border-outline rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none transition-shadow"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-primary text-on-primary font-semibold rounded-lg hover:opacity-90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? t('profileSettings.saving', 'Saving...') : t('profileSettings.saveBtn', 'Save Profile')}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30">
        <h2 className="text-lg font-semibold text-on-surface mb-2">{t('profileSettings.securityTitle', 'Security')}</h2>
        <p className="text-sm text-on-surface-variant mb-4">
          {t('profileSettings.securityDesc', 'Reset your password if you think your account has been compromised.')}
        </p>
        <Link
          to="/forgot-password"
          className="inline-flex items-center justify-center px-4 py-2 bg-surface-container text-on-surface-variant border border-outline rounded-lg text-sm font-semibold hover:bg-surface-container-high transition-all"
        >
          {t('profileSettings.resetPasswordBtn', 'Reset Password')}
        </Link>
      </section>
    </div>
  );
};
