import { describe, it } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
// Note: File is named RedTeamMaster.tsx for historical reasons but exports EmberUnitPage
import EmberUnitPage from '../src/pages/RedTeamMaster';
import { PhoenixProvider } from '../src/hooks/usePhoenixContext';

describe('EmberUnitPage', () => {
  it('renders without crashing', () => {
    render(
      <PhoenixProvider value={{
        executeOrchestratorScan: () => {},
        invokeCoreCommand: async () => {},
        cybersecurityStatus: async () => ({ armed: false, hak5Devices: [] })
      }}>
        <EmberUnitPage />
      </PhoenixProvider>
    );
  });
});