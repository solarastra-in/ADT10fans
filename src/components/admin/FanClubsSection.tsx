import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import type { FanClub, VenueOffer } from '../../types';
import { Button, Card, Notice, NoticeState, SectionHeader, TextInput, Select } from './ui';

export const FanClubsSection: React.FC = () => {
  const [clubs, setClubs] = useState<FanClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClub, setEditingClub] = useState<Partial<FanClub> | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const loadClubs = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminFanClubs();
      setClubs(res.fanClubs || []);
    } catch (err: any) {
      setNotice({ kind: 'err', text: err?.message || 'Failed to load fan clubs' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClubs();
  }, []);

  const handleSeed = async () => {
    if (!window.confirm('Reset fan clubs to the official seed list (including Hyderabad & UAE chapters)?')) return;
    try {
      const res = await api.seedAdminFanClubs();
      setClubs(res.fanClubs);
      setNotice({ kind: 'ok', text: res.message || 'Official fan clubs seeded successfully!' });
    } catch (err: any) {
      setNotice({ kind: 'err', text: err?.message || 'Failed to seed fan clubs' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}" fan club?`)) return;
    try {
      await api.deleteAdminFanClub(id);
      setClubs(prev => prev.filter(c => c.id !== id));
      setNotice({ kind: 'ok', text: `Removed ${name}` });
    } catch (err: any) {
      setNotice({ kind: 'err', text: err?.message || 'Failed to delete fan club' });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClub?.name || !editingClub?.city || !editingClub?.address) {
      setNotice({ kind: 'err', text: 'Name, City, and Address are required' });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const res = await api.saveAdminFanClub(editingClub);
      setEditingClub(null);
      await loadClubs();
      setNotice({ kind: 'ok', text: `Saved fan club "${res.fanClub.name}"!` });
    } catch (err: any) {
      setNotice({ kind: 'err', text: err?.message || 'Failed to save fan club' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Fan Clubs & Matchday Check-In Desks"
        description="Manage global and Hyderabad fan club venues, watch parties, capacity, and check-in desk operations."
        actions={
          <div className="flex items-center gap-2">
            <a
              href="/admin/fanclub"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-xs transition-colors shadow"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Open Live QR Scanner
            </a>
            <Button size="sm" variant="secondary" onClick={handleSeed}>
              Seed Official Clubs
            </Button>
            <Button
              size="sm"
              onClick={() =>
                setEditingClub({
                  id: '',
                  name: '',
                  city: 'Hyderabad',
                  country: 'India',
                  address: '',
                  region: 'hyderabad',
                  capacity: 250,
                  active: true,
                  offers: [],
                })
              }
            >
              + Add Fan Club
            </Button>
          </div>
        }
      />

      {notice && <Notice notice={notice} onClose={() => setNotice(null)} />}

      {/* Edit / Add Modal Form */}
      {editingClub && (
        <Card className="p-6 border-gold-500/40 bg-navy-900/90 shadow-xl">
          <h3 className="text-base font-bold text-white mb-4">
            {editingClub.id ? 'Edit Fan Club Venue' : 'Create New Fan Club Venue'}
          </h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-navy-300 uppercase mb-1">Fan Club Name</label>
                <TextInput
                  value={editingClub.name || ''}
                  onChange={e => setEditingClub({ ...editingClub, name: e.target.value })}
                  placeholder="e.g. Hyderabad Aces Hub - HITEC City"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-300 uppercase mb-1">Region</label>
                <Select
                  value={editingClub.region || 'hyderabad'}
                  onChange={e => setEditingClub({ ...editingClub, region: e.target.value as any })}
                >
                  <option value="hyderabad">Hyderabad, India (Primary Hub)</option>
                  <option value="uae">UAE (Abu Dhabi / Dubai)</option>
                  <option value="international">International Chapter</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-300 uppercase mb-1">City</label>
                <TextInput
                  value={editingClub.city || ''}
                  onChange={e => setEditingClub({ ...editingClub, city: e.target.value })}
                  placeholder="Hyderabad"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-300 uppercase mb-1">Country</label>
                <TextInput
                  value={editingClub.country || ''}
                  onChange={e => setEditingClub({ ...editingClub, country: e.target.value })}
                  placeholder="India"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-navy-300 uppercase mb-1">Address & Landmark</label>
                <TextInput
                  value={editingClub.address || ''}
                  onChange={e => setEditingClub({ ...editingClub, address: e.target.value })}
                  placeholder="e.g. Road No. 36, Jubilee Hills / HITEC City Main Rd"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-300 uppercase mb-1">Capacity</label>
                <TextInput
                  type="number"
                  value={String(editingClub.capacity || 200)}
                  onChange={e => setEditingClub({ ...editingClub, capacity: parseInt(e.target.value) || 100 })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy-300 uppercase mb-1">Venue Coordinator / Contact</label>
                <TextInput
                  value={editingClub.contactPerson || ''}
                  onChange={e => setEditingClub({ ...editingClub, contactPerson: e.target.value })}
                  placeholder="Contact Name & Mobile"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gold-400 uppercase mb-1">
                  Venue Managers (More than 1 manager allowed)
                </label>
                <TextInput
                  value={(editingClub.managerEmails || []).join(', ')}
                  onChange={e => {
                    const emails = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    setEditingClub({ ...editingClub, managerEmails: emails });
                  }}
                  placeholder="solarastra.in@gmail.com, admin@aces.com, venue_lead@hyd.com"
                />
                <p className="text-[11px] text-navy-400 mt-1">
                  Separate multiple emails with commas. These authorized venue managers can log in with their personal fan profile and operate the live QR scanner / manual check-in desk at <span className="font-mono text-gold-400">/admin/fanclub</span>.
                </p>
              </div>

              {/* Venue Perks Editor */}
              <div className="sm:col-span-2 pt-2 border-t border-navy-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-navy-300 uppercase">
                    Venue Perks & Offers (Single-Use per Fan at this Venue)
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const newOffer: VenueOffer = {
                        id: `offer_${Date.now()}`,
                        fanClubId: editingClub.id || '',
                        title: 'Matchday Drink / Snack Voucher',
                        description: 'Redeemable at venue counter during match interval',
                        perk: 'Free Beverage or Snack',
                        active: true,
                      };
                      setEditingClub({
                        ...editingClub,
                        offers: [...(editingClub.offers || []), newOffer],
                      });
                    }}
                  >
                    + Add Perk
                  </Button>
                </div>

                <div className="space-y-2">
                  {(!editingClub.offers || editingClub.offers.length === 0) ? (
                    <div className="text-xs text-navy-400 p-3 bg-navy-950/60 rounded-xl border border-navy-800">
                      No perks configured for this venue yet. Click "+ Add Perk" to create exclusive venue perks.
                    </div>
                  ) : (
                    editingClub.offers.map((offer, idx) => (
                      <div key={offer.id || idx} className="p-3 bg-navy-950/90 rounded-xl border border-navy-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={offer.title}
                            onChange={e => {
                              const updated = [...(editingClub.offers || [])];
                              updated[idx] = { ...updated[idx], title: e.target.value };
                              setEditingClub({ ...editingClub, offers: updated });
                            }}
                            placeholder="Perk Title (e.g. Free Team Flag)"
                            className="bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1 text-xs text-white flex-1 font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (editingClub.offers || []).filter((_, i) => i !== idx);
                              setEditingClub({ ...editingClub, offers: updated });
                            }}
                            className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={offer.perk}
                            onChange={e => {
                              const updated = [...(editingClub.offers || [])];
                              updated[idx] = { ...updated[idx], perk: e.target.value };
                              setEditingClub({ ...editingClub, offers: updated });
                            }}
                            placeholder="Perk Summary (e.g. Free Aces Jersey Badge)"
                            className="bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1 text-xs text-gold-300"
                          />
                          <input
                            type="text"
                            value={offer.description}
                            onChange={e => {
                              const updated = [...(editingClub.offers || [])];
                              updated[idx] = { ...updated[idx], description: e.target.value };
                              setEditingClub({ ...editingClub, offers: updated });
                            }}
                            placeholder="Description / Claim instructions"
                            className="bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1 text-xs text-navy-300"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-navy-800">
              <Button type="button" variant="secondary" onClick={() => setEditingClub(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Venue & Perks'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Fan Clubs List */}
      {loading ? (
        <div className="p-8 text-center text-navy-400">Loading fan clubs...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map(club => (
            <Card key={club.id} className="p-4 border-navy-800 bg-navy-900/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400 uppercase tracking-wide">
                    {club.region === 'hyderabad' ? '🇮🇳 Hyderabad' : club.region === 'uae' ? '🇦🇪 UAE' : '🌍 Global'}
                  </span>
                  <span className="text-xs text-navy-400 font-mono">Cap: {club.capacity}</span>
                </div>
                <h4 className="font-bold text-white text-sm mb-1">{club.name}</h4>
                <p className="text-xs text-navy-300 mb-2">{club.address}</p>
                {club.contactPerson && (
                  <p className="text-[11px] text-navy-400">Coordinator: {club.contactPerson}</p>
                )}
                {club.managerEmails && club.managerEmails.length > 0 && (
                  <div className="mt-2 text-[11px] text-navy-400">
                    <span className="font-semibold text-slate-300">Desk Managers ({club.managerEmails.length}):</span>{' '}
                    <span className="font-mono text-gold-400/90 break-words">{club.managerEmails.join(', ')}</span>
                  </div>
                )}
                {club.offers && club.offers.length > 0 && (
                  <div className="mt-2 text-[11px] text-amber-400 font-medium">
                    {club.offers.length} Venue Perk{club.offers.length > 1 ? 's' : ''} Active
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-navy-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setEditingClub(club)}
                  className="text-xs font-semibold text-gold-400 hover:text-gold-300"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(club.id, club.name)}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
