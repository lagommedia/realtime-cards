'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export const GRADING_COMPANIES = [
  { id: 'psa', label: 'PSA', description: 'Most widely collected' },
  { id: 'bgs', label: 'BGS', description: 'Beckett grading' },
  { id: 'sgc', label: 'SGC', description: 'Vintage & modern' },
] as const;

export type GradingCompanyId = typeof GRADING_COMPANIES[number]['id'];

export const GRADING_GRADES: Record<GradingCompanyId, Array<{ value: string; label: string; description: string }>> = {
  psa: [
    { value: '10', label: 'PSA 10', description: 'Gem Mint' },
    { value: '9',  label: 'PSA 9',  description: 'Mint' },
    { value: '8',  label: 'PSA 8',  description: 'NM-MT' },
    { value: '7',  label: 'PSA 7',  description: 'Near Mint' },
  ],
  bgs: [
    { value: '9.5', label: 'BGS 9.5', description: 'Gem Mint' },
    { value: '10',  label: 'BGS 10',  description: 'Pristine' },
    { value: '9',   label: 'BGS 9',   description: 'Mint' },
    { value: '8.5', label: 'BGS 8.5', description: 'NM-MT+' },
  ],
  sgc: [
    { value: '10',  label: 'SGC 10',  description: 'Pristine' },
    { value: '9.5', label: 'SGC 9.5', description: 'Mint+' },
    { value: '9',   label: 'SGC 9',   description: 'Mint' },
    { value: '8.5', label: 'SGC 8.5', description: 'NM-MT+' },
  ],
};

export const DEFAULT_GRADE: Record<GradingCompanyId, string> = {
  psa: '10',
  bgs: '9.5',
  sgc: '10',
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
    const storedCompany = localStorage.getItem('gradingCompany') as GradingCompanyId | null;
    if (storedCompany && GRADING_COMPANIES.some(c => c.id === storedCompany)) {
      setCompanyIdState(storedCompany);
      const storedGrade = localStorage.getItem(`gradingGrade_${storedCompany}`);
      const validGrades = GRADING_GRADES[storedCompany].map(g => g.value);
      setGradeValueState(storedGrade && validGrades.includes(storedGrade)
        ? storedGrade
        : DEFAULT_GRADE[storedCompany]);
    }
  }, []);

  const setCompanyId = (id: GradingCompanyId | null) => {
    setCompanyIdState(id);
    if (id === null) {
      localStorage.removeItem('gradingCompany');
      setGradeValueState(null);
    } else {
      localStorage.setItem('gradingCompany', id);
      // Restore previously saved grade for this company, or use default
      const storedGrade = localStorage.getItem(`gradingGrade_${id}`);
      const validGrades = GRADING_GRADES[id].map(g => g.value);
      const grade = storedGrade && validGrades.includes(storedGrade)
        ? storedGrade
        : DEFAULT_GRADE[id];
      setGradeValueState(grade);
    }
  };

  const setGradeValue = (grade: string) => {
    setGradeValueState(grade);
    if (companyId) localStorage.setItem(`gradingGrade_${companyId}`, grade);
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
