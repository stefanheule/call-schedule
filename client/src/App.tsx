import { useState } from 'react'
import './App.css'
import { Heading } from './common/text'
import initialData from './shared/init.json';
import { assertCallSchedule } from './shared/check-type.generated';

// TODO: remove this once there is at least one other type in client
// @check-type
export type DummyTypeApp = {
  field: string;
};

function App() {
  const [data, setData] = useState(assertCallSchedule(initialData));

  return (
    <>
      <div>
        <Heading>Tests</Heading>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
