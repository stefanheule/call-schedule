import {
  CallSchedule,
  CallScheduleProcessed,
  LocalData,
} from '../shared/types';
import { createContext, useContext } from 'react';

export const DataContext = createContext<
  | {
      data: CallSchedule;
      setData: React.Dispatch<React.SetStateAction<CallSchedule>>;
      processed: CallScheduleProcessed;
    }
  | undefined
>(undefined);

export const LocalDataContext = createContext<
  | {
      localData: LocalData;
      setLocalData: React.Dispatch<React.SetStateAction<LocalData>>;
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

export function useLocalData(): [
  LocalData,
  React.Dispatch<React.SetStateAction<LocalData>>,
] {
  const context = useContext(LocalDataContext);
  if (!context) {
    throw new Error('useLocalData must be used within a DataProvider');
  }
  return [context.localData, context.setLocalData];
}

export function useProcessedData(): CallScheduleProcessed {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useProcessedData must be used within a DataProvider');
  }
  return context.processed;
}
