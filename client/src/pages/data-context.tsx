import { CallSchedule } from '../shared/types';
import { createContext, useContext } from 'react';

export const DataContext = createContext<
  { data: CallSchedule; setData: React.Dispatch<CallSchedule> } | undefined
>(undefined);

// Create a custom hook to access the data and setData
export function useData(): [CallSchedule, React.Dispatch<CallSchedule>] {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return [context.data, context.setData];
}
