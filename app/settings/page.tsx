'use client';

import { useState } from 'react';
import { useTeam } from '@/context/TeamContext';
import { useBroadcast } from '@/context/BroadcastContext';
import { useGrading, GRADING_COMPANIES, GRADING_GRADES } from '@/context/GradingContext';
import { ALL_TEAMS } from '@/lib/team-themes';
import { Check, X } from 'lucide-react';
import TeamLogo from '@/components/TeamLogo';

const DIVISIONS = ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West'];

export default function SettingsPage() {
  const { theme, selectedTeamId, setSelectedTeamId } = useTeam();
  const { delaySec, setDelaySec } = useBroadcast();
  const { companyId, setCompanyId, gradeValue, setGradeValue } = useGrading();
  const [search, setSearch] = useState('');

  const filteredTeams = ALL_TEAMS.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.abbreviation.toLowerCase().includes(search.toLowerCase())
  );

  const selectedTeam = ALL_TEAMS.find(t => t.id === selectedTeamId);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-4 pt-12 pb-4" style={{ background: `linear-gradient(180deg, ${theme.primary}33 0%, transparent 100%)` }}>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-xs text-slate-500 mt-0.5">Personalize your experience</p>
      </div>

      <div className="px-4 space-y-6 pb-6">
        {/* Grading company */}
        <div>
          <p className="text-sm font-semibold text-slate-900 mb-1">Default Grading Company</p>
          <p className="text-xs text-slate-500 mb-3">Cards and prices will be filtered to your preferred grader</p>
          <div className="grid grid-cols-3 gap-2">
            {GRADING_COMPANIES.map(company => {
              const selected = companyId === company.id;
              return (
                <button
                  key={company.id}
                  onClick={() => setCompanyId(selected ? null : company.id)}
                  className="flex flex-col items-center justify-center px-3 py-4 rounded-xl transition-all text-center"
                  style={{
                    backgroundColor: selected ? `${theme.primary}22` : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${selected ? theme.primary : 'transparent'}`,
                  }}
                >
                  <span
                    className="text-xl font-black tracking-tight mb-1"
                    style={{ color: selected ? theme.primary : '#0f172a' }}
                  >
                    {company.label}
                  </span>
                  <span className="text-xs leading-tight" style={{ color: selected ? theme.primary : '#475569' }}>
                    {company.description}
                  </span>
                  {selected && (
                    <Check size={12} className="mt-1.5" style={{ color: theme.primary }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Grade picker — appears when a company is selected */}
          {companyId && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Select Grade</p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {GRADING_GRADES[companyId].map(grade => {
                  const selected = gradeValue === grade.value;
                  return (
                    <button
                      key={grade.value}
                      onClick={() => setGradeValue(grade.value)}
                      className="flex flex-col items-center flex-shrink-0 px-4 py-3 rounded-xl transition-all"
                      style={{
                        backgroundColor: selected ? `${theme.primary}22` : 'rgba(0,0,0,0.04)',
                        border: `1px solid ${selected ? theme.primary : 'transparent'}`,
                        minWidth: 72,
                      }}
                    >
                      <span
                        className="text-base font-black tracking-tight"
                        style={{ color: selected ? theme.primary : '#0f172a' }}
                      >
                        {grade.label}
                      </span>
                      <span
                        className="text-xs mt-0.5 whitespace-nowrap"
                        style={{ color: selected ? theme.primary : '#475569' }}
                      >
                        {grade.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Broadcast delay */}
        <div>
          <p className="text-sm font-semibold text-slate-900 mb-1">Broadcast Delay</p>
          <p className="text-xs text-slate-500 mb-4">Calibrate to match your TV or streaming delay</p>

          {/* Value display */}
          <div className="flex items-baseline justify-center gap-1.5 mb-5">
            <span className="text-5xl font-black tabular-nums" style={{ color: theme.primary }}>
              {delaySec}
            </span>
            <span className="text-xl text-slate-400 font-semibold">sec</span>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={0}
            max={120}
            step={1}
            value={delaySec}
            onChange={e => setDelaySec(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: theme.primary }}
          />

          {/* Scale labels */}
          <div className="flex justify-between mt-2 text-[10px] text-gray-600 font-medium">
            <span>0s</span>
            <span>30s</span>
            <span>60s</span>
            <span>90s</span>
            <span>120s</span>
          </div>

          {/* Context hint */}
          <p className="text-xs text-center mt-4 font-medium" style={{ color: `${theme.primary}bb` }}>
            {delaySec === 0
              ? 'No delay · At the ballpark or watching live'
              : delaySec <= 5
              ? 'Cable / Satellite TV'
              : delaySec <= 50
              ? 'Streaming (YouTube TV, Hulu, fuboTV)'
              : delaySec <= 65
              ? 'Apple TV+ / Peacock'
              : 'MLB.tv / High-latency streaming'}
          </p>
        </div>

        {/* Current team */}
        <div className="rounded-2xl p-4 border border-slate-200" style={{ backgroundColor: theme.cardBackground }}>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">Favorite Team</p>
          {selectedTeam ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TeamLogo teamId={selectedTeam.id} abbreviation={selectedTeam.abbreviation} size={44} />
                <div>
                  <p className="text-slate-900 font-semibold">{selectedTeam.name}</p>
                  <p className="text-xs text-slate-500">{selectedTeam.division}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTeamId(null)}
                className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No team selected · App uses default theme</p>
          )}
        </div>

        {/* Team picker */}
        <div>
          <p className="text-sm font-semibold text-slate-900 mb-3">Select Your Team</p>

          {/* Search */}
          <input
            type="text"
            placeholder="Search teams..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl mb-4 text-slate-900 text-sm outline-none border border-slate-200 focus:border-slate-400 transition-colors"
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
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">{division}</p>
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
        <div className="rounded-2xl p-4 border border-slate-200 space-y-3" style={{ backgroundColor: theme.cardBackground }}>
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
        backgroundColor: selected ? `${theme.primary}22` : 'rgba(0,0,0,0.04)',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: selected ? theme.primary : 'transparent',
      }}
    >
      <TeamLogo teamId={team.id} abbreviation={team.abbreviation} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-slate-900 text-sm font-medium">{team.name}</p>
        <p className="text-slate-500 text-xs">{team.division}</p>
      </div>
      {selected && <Check size={16} style={{ color: theme.primary }} />}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-slate-500 text-sm">{label}</p>
      <p className="text-slate-900 text-sm font-medium">{value}</p>
    </div>
  );
}
