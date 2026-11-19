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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950 tracking-tight flex items-center gap-2.5 font-display">
            <div className="w-10 h-10 rounded-2xl bg-health-50 border border-health-100 flex items-center justify-center text-health-600">
              <Users className="w-5 h-5" />
            </div>
            {t('family_title')}
          </h1>
          <p className="text-sm text-navy-600 mt-1 max-w-2xl font-sans">{t('family_subtitle')}</p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setShowAddModal(true)}
          className="shadow-md shadow-health-600/20"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {t('btn_add_family')}
        </Button>
      </div>

      {/* Profiles Grid */}
      {loading ? (
        <Card>
          <CardContent className="py-20 text-center text-sm text-navy-500 flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-health-600 border-t-transparent animate-spin mb-3" />
            Loading family profiles...
          </CardContent>
        </Card>
      ) : profiles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-navy-900 font-display">No family profiles added yet</h3>
            <p className="text-xs text-navy-500 mt-1 max-w-sm mx-auto mb-5">
              Add dependent profiles to organize medical documents separately for children or elderly parents.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('btn_add_family')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {profiles.map((profile) => (
            <Card
              key={profile.id}
              className="p-5 hover:border-health-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                      {getRelationIcon(profile.relationship)}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-navy-950 font-display">{profile.full_name}</h2>
                      <Badge variant="teal" className="text-[10px] uppercase font-bold mt-0.5">
                        {profile.relationship}
                      </Badge>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(profile.id, profile.full_name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete profile"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100">
                  {profile.date_of_birth && (
                    <p className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono">DOB: {profile.date_of_birth}</span>
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
                <span className="text-[10px] text-slate-400 font-mono">
                  Added on {profile.created_at.slice(0, 10)}
                </span>
                <span className="font-bold text-health-600 text-[11px] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  Isolated Records
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Family Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-base font-bold text-navy-950 border-b border-slate-100 pb-3 font-display">
              {t('family_add_modal_title')}
            </h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy-800 mb-1">
                  {t('family_name_label')} *
                </label>
                <Input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Leo Miller"
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy-800 mb-1">
                    {t('family_relation_label')} *
                  </label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-navy-900 bg-white focus:outline-none focus:ring-2 focus:ring-health-500"
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy-800 mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 text-navy-900 bg-white focus:outline-none focus:ring-2 focus:ring-health-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy-800 mb-1">
                  {t('family_dob_label')}
                </label>
                <Input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  {t('btn_cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                >
                  {submitting ? 'Adding...' : t('btn_add_family')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
