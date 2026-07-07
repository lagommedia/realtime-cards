'use client';

import { useState } from 'react';
import { useTeam } from '@/context/TeamContext';
import { useBroadcast, BROADCAST_PLATFORMS } from '@/context/BroadcastContext';
import { ALL_TEAMS } from '@/lib/team-themes';
import { Check, X } from 'lucide-react';
import TeamLogo from '@/components/TeamLogo';

const DIVISIONS = ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West'];

export default function SettingsPage() {
  const { theme, selectedTeamId, setSelectedTeamId } = useTeam();
  const { platformId, setPlatformId } = useBroadcast();
  const [search, setSearch] = useState('');

  const filteredTeams = ALL_TEAMS.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.abbreviation.toLowerCase().includes(search.toLowerCase())
  );

  const selectedTeam = ALL_TEAMS.find(t => t.id === selectedTeamId);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0f1e' }}>
      {/* Header */}
      <div className="px-4 pt-12 pb-4" style={{ background: `linear-gradient(180deg, ${theme.primary}33 0%, transparent 100%)` }}>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-xs text-gray-400 mt-0.5">Personalize your experience</p>
      </div>

      <div className="px-4 space-y-6 pb-6">
        {/* Broadcast platform */}
        <div>
          <p className="text-sm font-semibold text-white mb-1">How do you watch your games?</p>
          <p className="text-xs text-gray-500 mb-3">Calibrates live data to match your broadcast delay</p>
          <div className="grid grid-cols-2 gap-2">
            {BROADCAST_PLATFORMS.map(platform => {
              const selected = platformId === platform.id;
              return (
                <button
                  key={platform.id}
                  onClick={() => setPlatformId(selected ? null : platform.id)}
                  className="flex flex-col items-start px-3 py-3 rounded-xl transition-all text-left"
                  style={{
                    backgroundColor: selected ? `${theme.primary}22` : '#ffffff08',
                    border: `1px solid ${selected ? theme.primary : 'transparent'}`,
                  }}
                >
                  <div className="flex items-center justify-between w-full mb-0.5">
                    <span className="text-white text-sm font-medium leading-tight">{platform.label}</span>
                    {selected && <Check size={13} style={{ color: theme.primary, flexShrink: 0 }} />}
                  </div>
                  <span className="text-xs" style={{ color: selected ? theme.primary : '#6b7280' }}>
                    {platform.sublabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Current team */}
        <div className="rounded-2xl p-4 border border-white/10" style={{ backgroundColor: theme.cardBackground }}>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-medium">Favorite Team</p>
          {selectedTeam ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TeamLogo teamId={selectedTeam.id} abbreviation={selectedTeam.abbreviation} size={44} />
                <div>
                  <p className="text-white font-semibold">{selectedTeam.name}</p>
                  <p className="text-xs text-gray-400">{selectedTeam.division}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTeamId(null)}
                className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No team selected · App uses default theme</p>
          )}
        </div>

        {/* Team picker */}
        <div>
          <p className="text-sm font-semibold text-white mb-3">Select Your Team</p>

          {/* Search */}
          <input
            type="text"
            placeholder="Search teams..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl mb-4 text-white text-sm outline-none border border-white/10 focus:border-white/30 transition-colors"
            style={{ backgroundColor: theme.cardBackground }}
          />

          {/* Teams by division */}
          {search ? (
            <div className="space-y-2">
              {filteredTeams.map(team => (
                <TeamRow
                  key={team.id}
                  team={team}
                  selected={selectedTeamId === team.id}
                  onSelect={() => setSelectedTeamId(team.id)}
                  theme={theme}
                />
              ))}
              {filteredTeams.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">No teams found</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {DIVISIONS.map(division => {
                const divTeams = ALL_TEAMS.filter(t => t.division === division);
                return (
                  <div key={division}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">{division}</p>
                    <div className="space-y-1.5">
                      {divTeams.map(team => (
                        <TeamRow
                          key={team.id}
                          team={team}
                          selected={selectedTeamId === team.id}
                          onSelect={() => setSelectedTeamId(selectedTeamId === team.id ? null : team.id)}
                          theme={theme}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* About */}
        <div className="rounded-2xl p-4 border border-white/10 space-y-3" style={{ backgroundColor: theme.cardBackground }}>
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">About</p>
          <InfoRow label="Data Sources" value="MLB Stats API + eBay Browse API" />
          <InfoRow label="Price Refresh" value="Every 5 minutes" />
          <InfoRow label="Game Refresh" value="Every 90 seconds" />
          <InfoRow label="eBay Credentials" value={process.env.NEXT_PUBLIC_EBAY_CONFIGURED === 'true' ? 'Connected' : 'Mock data mode'} />
        </div>
      </div>
    </div>
  );
}

function TeamRow({
  team, selected, onSelect, theme
}: {
  team: typeof ALL_TEAMS[0];
  selected: boolean;
  onSelect: () => void;
  theme: ReturnType<typeof useTeam>['theme'];
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
      style={{
        backgroundColor: selected ? `${theme.primary}22` : '#ffffff08',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: selected ? theme.primary : 'transparent',
      }}
    >
      <TeamLogo teamId={team.id} abbreviation={team.abbreviation} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium">{team.name}</p>
        <p className="text-gray-500 text-xs">{team.division}</p>
      </div>
      {selected && <Check size={16} style={{ color: theme.primary }} />}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-white text-sm font-medium">{value}</p>
    </div>
  );
}
