import React from 'react';
import initialData from './shared/init.json';
import { assertCallSchedule } from './shared/check-type.generated';
import { MainLayout } from './pages/layout';
import { DataContext } from './pages/data-context';
import { RenderCallSchedule } from './pages/schedule';
import { LocalData } from './shared/types';
import { DndContext } from '@dnd-kit/core';
import { processCallSchedule } from './shared/compute';

function App() {
  const [data, setData] = React.useState(assertCallSchedule(initialData));
  const [localData, setLocalData] = React.useState<LocalData>({
    highlightedIssues: {},
    highlightedPeople: {},
  });
  const processed = processCallSchedule(data);

  return (
    <DataContext.Provider
      value={{ data, setData, processed, localData, setLocalData }}
    >
      <DndContext>
        <MainLayout>
          <RenderCallSchedule />
        </MainLayout>
      </DndContext>
    </DataContext.Provider>
  );
}

export default App;
