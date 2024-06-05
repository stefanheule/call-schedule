import React from 'react';
import { MainLayout } from './pages/layout';
import { DataContext, LocalDataContext } from './pages/data-context';
import { RenderCallSchedule } from './pages/schedule';
import { CallSchedule, LocalData } from './shared/types';
import { DndContext } from '@dnd-kit/core';
import { processCallSchedule } from './shared/compute';
import {
  RouteObject,
  RouterProvider,
  createBrowserRouter,
} from 'react-router-dom';
import { HistoryPage } from './pages/history';
import { LoadingIndicator } from './common/loading';
import { useAsync } from './common/hooks';
import { rpcLoadCallSchedules } from './pages/rpc';
import { Text } from './common/text';
import { deepCopy } from 'check-type';

export const ROUTES: (RouteObject & {
  navigationTitle?: string;
  path: string;
  notShownInNavigation?: boolean;
})[] = [
  {
    path: '/',
    navigationTitle: 'Call Schedule',
    element: <Ui />,
  },
  {
    path: '/history',
    navigationTitle: 'History',
    element: <HistoryPage />,
  },
];

const router = createBrowserRouter(ROUTES);

export function Ui() {
  const [localData, setLocalData] = React.useState<LocalData>({
    highlightedPeople: {},
    history: [],
    undoHistory: [],
    unsavedChanges: 0,
  });
  return (
    <LocalDataContext.Provider value={{ localData, setLocalData }}>
      <DndContext>
        <MainLayout>
          <RenderCallSchedule />
        </MainLayout>
      </DndContext>
    </LocalDataContext.Provider>
  );
}

function App() {
  const [data, setData] = React.useState<CallSchedule | undefined>(undefined);
  const [initialData, setInitialData] = React.useState<
    CallSchedule | undefined
  >(undefined);
  const [error, setError] = React.useState('');

  useAsync(async () => {
    if (data === undefined) {
      try {
        const d = await rpcLoadCallSchedules({});
        setData(d);
        setInitialData(deepCopy(d));
      } catch (e) {
        console.log(e);
        setError(`Failed to fetch latest schedule. Please reload the page.`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  console.log('render');

  if (error !== '') {
    return (
      <MainLayout>
        <Text>{error}</Text>
      </MainLayout>
    );
  }

  if (data === undefined || initialData === undefined) {
    return (
      <MainLayout>
        <LoadingIndicator />
      </MainLayout>
    );
  }

  const processed = processCallSchedule(data);

  return (
    <DataContext.Provider
      value={{
        data,
        initialData,
        setData: setData as unknown as React.Dispatch<
          React.SetStateAction<CallSchedule>
        >,
        processed,
      }}
    >
      <RouterProvider router={router} />
    </DataContext.Provider>
  );
}

export default App;
