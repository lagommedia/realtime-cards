'use client';

import { usePathname } from 'next/navigation';
import Navigation from '@/components/Navigation';

export default function ConditionalNav() {
  const pathname = usePathname();
  if (pathname === '/login') return null;
  return <Navigation />;
}
