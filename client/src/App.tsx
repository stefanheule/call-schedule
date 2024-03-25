import React from 'react';
import initialData from './shared/init.json';
import { assertCallSchedule } from './shared/check-type.generated';
import { MainLayout } from './pages/layout';
import { DataContext } from './pages/data-context';
import { RenderCallSchedule } from './pages/schedule';
import { CallSchedule, CallScheduleProcessed } from './shared/types';
import { DndContext } from '@dnd-kit/core';

function App() {
  const [data, setData] = React.useState(assertCallSchedule(initialData));
  const processed = processCallSchedule(data);

  return (
    <DataContext.Provider value={{ data, setData, processed }}>
      <DndContext>
        <MainLayout>
          <RenderCallSchedule />
        </MainLayout>
      </DndContext>
    </DataContext.Provider>
  );
}

function processCallSchedule(data: CallSchedule): CallScheduleProcessed {
  const result: CallScheduleProcessed = {
    day2hospital2people: {},
    day2vacation: {},
    issues: {
      test: {
        message: 'This is a test issue',
      },
    },
    shift2issue: {},
  };
  return result;
}

export default App;
