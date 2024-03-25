import { CallSchedule, CallScheduleProcessed } from '../shared/types';
import { createContext, useContext } from 'react';

export const DataContext = createContext<
  | {
      data: CallSchedule;
      setData: React.Dispatch<React.SetStateAction<CallSchedule>>;
      processed: CallScheduleProcessed;
    }
  | undefined
>(undefined);

// Create a custom hook to access the data and setData
export function useData(): [
  CallSchedule,
  React.Dispatch<React.SetStateAction<CallSchedule>>,
] {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return [context.data, context.setData];
}

export function useProcessedData(): CallScheduleProcessed {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context.processed;
}
