'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export const GRADING_COMPANIES = [
  { id: 'psa', label: 'PSA', description: 'Most widely collected' },
] as const;

export type GradingCompanyId = 'psa';

export const GRADING_GRADES: Record<GradingCompanyId, Array<{ value: string; label: string; description: string }>> = {
  psa: [
    { value: '10', label: 'PSA 10', description: 'Gem Mint' },
    { value: '9',  label: 'PSA 9',  description: 'Mint' },
    { value: '8',  label: 'PSA 8',  description: 'NM-MT' },
    { value: '7',  label: 'PSA 7',  description: 'Near Mint' },
  ],
};

export const DEFAULT_GRADE: Record<GradingCompanyId, string> = {
  psa: '10',
};

interface GradingContextValue {
  companyId: GradingCompanyId | null;
  setCompanyId: (id: GradingCompanyId | null) => void;
  gradeValue: string | null;
  setGradeValue: (grade: string) => void;
}

const GradingContext = createContext<GradingContextValue | null>(null);

export function GradingProvider({ children }: { children: React.ReactNode }) {
  const [companyId, setCompanyIdState] = useState<GradingCompanyId | null>(null);
  const [gradeValue, setGradeValueState] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('gradingCompany');
    if (stored === 'psa') {
      setCompanyIdState('psa');
      const storedGrade = localStorage.getItem('gradingGrade_psa');
      const valid = GRADING_GRADES.psa.map(g => g.value);
      setGradeValueState(storedGrade && valid.includes(storedGrade) ? storedGrade : '10');
    }
  }, []);

  const setCompanyId = (id: GradingCompanyId | null) => {
    setCompanyIdState(id);
    if (id === null) {
      localStorage.removeItem('gradingCompany');
      setGradeValueState(null);
    } else {
      localStorage.setItem('gradingCompany', id);
      const storedGrade = localStorage.getItem('gradingGrade_psa');
      const valid = GRADING_GRADES.psa.map(g => g.value);
      setGradeValueState(storedGrade && valid.includes(storedGrade) ? storedGrade : '10');
    }
  };

  const setGradeValue = (grade: string) => {
    setGradeValueState(grade);
    localStorage.setItem('gradingGrade_psa', grade);
  };

  return (
    <GradingContext.Provider value={{ companyId, setCompanyId, gradeValue, setGradeValue }}>
      {children}
    </GradingContext.Provider>
  );
}

export function useGrading() {
  const ctx = useContext(GradingContext);
  if (!ctx) throw new Error('useGrading must be used inside GradingProvider');
  return ctx;
}
