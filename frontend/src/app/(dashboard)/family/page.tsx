'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  User,
  Calendar,
  Trash2,
  ShieldCheck,
  AlertCircle,
  Heart,
  Baby,
  UserCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

interface FamilyProfile {
  id: string;
  account_owner_id: string;
  full_name: string;
  relationship: string;
  date_of_birth?: string | null;
  gender?: string | null;
  created_at: string;
}

export default function FamilyProfilesPage() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New profile form
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState('Child');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await api.listFamilyProfiles();
      setProfiles(data || []);
    } catch (err) {
      console.error('Failed to load family profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSubmitting(true);
    try {
      await api.createFamilyProfile({
        full_name: fullName.trim(),
        relationship,
        date_of_birth: dob || undefined,
        gender: gender || undefined,
      });
      setShowAddModal(false);
      setFullName('');
      setDob('');
      loadProfiles();
    } catch (err) {
      console.error('Failed to create family profile:', err);
      alert('Failed to add family member profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}'s profile?`)) return;
    try {
      await api.deleteFamilyProfile(id);
      setProfiles(profiles.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete family profile:', err);
      alert('Failed to delete profile.');
    }
  };

  const getRelationIcon = (rel: string) => {
    switch (rel.toLowerCase()) {
      case 'child':
        return <Baby className="w-5 h-5 text-teal-600" />;
      case 'spouse':
        return <Heart className="w-5 h-5 text-rose-500" />;
      case 'parent':
        return <UserCheck className="w-5 h-5 text-indigo-600" />;
      default:
        return <User className="w-5 h-5 text-sky-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-health-600" />
            {t('family_title')}
          </h1>
          <p className="text-sm text-navy-600 mt-1">{t('family_subtitle')}</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-health-600 hover:bg-health-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all"
        >
          <Plus className="w-4 h-4" />
          {t('btn_add_family')}
        </button>
      </div>

      {/* Profiles Grid */}
      {loading ? (
        <div className="py-20 text-center text-sm text-navy-500 flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-health-500 border-t-transparent animate-spin mb-3" />
          Loading family profiles...
        </div>
      ) : profiles.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-navy-800">No family profiles added yet</p>
          <p className="text-xs text-navy-500 mt-1 max-w-sm mx-auto mb-5">
            Add dependent profiles to organize medical documents separately for children or elderly parents.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-navy-900 text-white rounded-xl text-xs font-semibold hover:bg-navy-800"
          >
            {t('btn_add_family')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-health-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                      {getRelationIcon(profile.relationship)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-navy-950">{profile.full_name}</h3>
                      <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                        {profile.relationship}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(profile.id, profile.full_name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete profile"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  {profile.date_of_birth && (
                    <p className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>DOB: {profile.date_of_birth}</span>
                    </p>
                  )}
                  {profile.gender && (
                    <p className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Gender: {profile.gender}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400">
                  Added on {profile.created_at.slice(0, 10)}
                </span>
                <span className="font-semibold text-health-600 text-xs flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Isolated Records
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Family Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5">
            <h2 className="text-base font-bold text-navy-950 border-b border-slate-100 pb-3">
              {t('family_add_modal_title')}
            </h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-navy-800 mb-1">
                  {t('family_name_label')} *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Leo Miller"
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-navy-900 focus:ring-2 focus:ring-health-500/20 focus:border-health-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-navy-800 mb-1">
                    {t('family_relation_label')} *
                  </label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-navy-900 bg-white focus:ring-2 focus:ring-health-500/20 focus:border-health-500"
                  >
                    <option value="Child">Child</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Dependent">Dependent</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-navy-800 mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-navy-900 bg-white focus:ring-2 focus:ring-health-500/20 focus:border-health-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-800 mb-1">
                  {t('family_dob_label')}
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 text-navy-900 focus:ring-2 focus:ring-health-500/20 focus:border-health-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-health-600 hover:bg-health-700 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  {submitting ? 'Adding...' : t('btn_add_family')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
