import React, { useState } from 'react';
import initialData from './shared/init.json';
import { assertCallSchedule } from './shared/check-type.generated';
import { MainLayout } from './pages/layout';
import { DataContext } from './pages/data-context';
import { RenderCallSchedule } from './pages/schedule';

function App() {
  const [data, setData] = useState(assertCallSchedule(initialData));
  console.log(data);

  return (
    <DataContext.Provider value={{ data, setData }}>
      <MainLayout>
        <RenderCallSchedule />
      </MainLayout>
    </DataContext.Provider>
  );
}

export default App;
