'use client';

import { useTeam } from '@/context/TeamContext';

export default function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  const { theme } = useTeam();
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div
        className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: `${theme.primary}44`, borderTopColor: theme.primary }}
      />
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
}
