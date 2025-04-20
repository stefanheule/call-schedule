import React, { useEffect } from 'react';
import { MainLayout } from './pages/layout';
import { DataContext, LocalDataContext, useData } from './pages/data-context';
import { RenderCallSchedule } from './pages/schedule';
import { AcademicYear, CallSchedule, LocalData } from './shared/types';
import { DndContext } from '@dnd-kit/core';
import { processCallSchedule } from './shared/compute';
import {
  RouteObject,
  RouterProvider,
  createBrowserRouter,
  useNavigate,
} from 'react-router-dom';
import { HistoryPage } from './pages/history';
import { LoadingIndicator } from './common/loading';
import { useAsync } from './common/hooks';
import { rpcLoadCallSchedules } from './pages/rpc';
import { Text } from './common/text';
import { deepCopy } from './shared/common/check-type';

export const ROUTES: (RouteObject & {
  navigationTitle?: string;
  path: string;
  notShownInNavigation?: boolean;
})[] = [
  {
    path: '/',
    navigationTitle: 'Call Schedule',
    element: <Redirect to="/24" />,
  },
  {
    path: '/24',
    navigationTitle: 'Call Schedule',
    element: <App academicYear={'24'} path='schedule' />,
  },
  {
    path: '/25',
    navigationTitle: 'Call Schedule',
    element: <App academicYear={'25'} path='schedule' />,
  },
  {
    path: '/24/history',
    navigationTitle: 'History',
    element: <App academicYear={'24'} path='history' />,
  },
  {
    path: '/25/history',
    navigationTitle: 'History',
    element: <App academicYear={'25'} path='history' />,
  },
];


export function Redirect(props: { to: string }): React.ReactNode {
  const navigate = useNavigate();
  useEffect(() => {
    if (props.to.startsWith('http://') || props.to.startsWith('https://')) {
      window.location.href = props.to;
      return;
    }
    void navigate(props.to, { replace: true });
  }, [navigate, props.to]);
  return <></>;
}


const router = createBrowserRouter(ROUTES);

export function Ui() {
  const [localData, setLocalData] = React.useState<LocalData>({
    highlightedPeople: {},
    history: [],
    undoHistory: [],
    unsavedChanges: 0,
  });
  const [data] = useData();
  useEffect(() => {
    if (data !== undefined && localData.processedFromLastSave === undefined) {
      setLocalData({
        ...localData,
        processedFromLastSave: processCallSchedule(data),
      });
    }
  }, [data, localData]);
  return (
    <LocalDataContext.Provider value={{ localData, setLocalData }}>
      <DndContext>
        <MainLayout noMargin>
          <RenderCallSchedule />
        </MainLayout>
      </DndContext>
    </LocalDataContext.Provider>
  );
}

function App({ academicYear, path }: { academicYear: AcademicYear, path: 'history' | 'schedule' }) {
  const [data, setData] = React.useState<CallSchedule | undefined>(undefined);
  const [initialData, setInitialData] = React.useState<
    CallSchedule | undefined
  >(undefined);
  const [error, setError] = React.useState('');

  useAsync(async () => {
    try {
      const d = await rpcLoadCallSchedules({ academicYear });
      setData(d);
      setInitialData(prev => {
        if (prev === undefined || prev.academicYear !== academicYear) {
          return deepCopy(d);
        }
        return prev;
      });
    } catch (e) {
      console.log(e);
      setError(`Failed to fetch latest schedule. Please reload the page.`);
    }
  }, [academicYear]);

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

  if (data.isPublic === true && data.isPubliclyVisible === false) {
    return (
      <MainLayout>
        <Text>This schedule is not available.</Text>
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
      {path === 'history' && <HistoryPage />}
      {path === 'schedule' && <Ui />}
    </DataContext.Provider>
  );
}

function AppRouter() {
  return <RouterProvider router={router} />;
}

export default AppRouter;
