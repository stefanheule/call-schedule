import { useState } from 'react'
import './App.css'
import { Heading } from './common/text'

// TODO: remove this once there is at least one other type in client
// @check-type
export type DummyTypeApp = {
  field: string;
};

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <Heading>Tests</Heading>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
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
