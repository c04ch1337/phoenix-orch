import React from 'react';
import ConsoleMaster from './ConsoleMaster';

/**
 * Test component for demonstrating the ConsoleMaster integration
 */
const ConsoleTest: React.FC = () => {
  return (
    <div className="h-screen bg-zinc-950 flex flex-col">
      <header className="bg-zinc-900 p-4 text-zinc-100">
        <h1 className="text-xl font-semibold">Phoenix Orch - VS Code-Like Console Test</h1>
      </header>
      
      <main className="flex-1 p-4">
        <ConsoleMaster className="h-full" />
      </main>
    </div>
  );
};

export default ConsoleTest;