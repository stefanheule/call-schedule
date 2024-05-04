import React from 'react';
import initialData from './shared/init.json';
import { assertCallSchedule } from './shared/check-type.generated';
import { MainLayout } from './pages/layout';
import { DataContext, LocalDataContext } from './pages/data-context';
import { RenderCallSchedule } from './pages/schedule';
import { LocalData } from './shared/types';
import { DndContext } from '@dnd-kit/core';
import { processCallSchedule } from './shared/compute';

function Ui() {
  const [localData, setLocalData] = React.useState<LocalData>({
    highlightedPeople: {},
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
  const [data, setData] = React.useState(assertCallSchedule(initialData));
  const processed = processCallSchedule(data);

  return (
    <DataContext.Provider value={{ data, setData, processed }}>
      <Ui />
    </DataContext.Provider>
  );
}

export default App;
