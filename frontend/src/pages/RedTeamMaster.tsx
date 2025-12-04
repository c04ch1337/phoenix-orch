import React from 'react';
// Import EmberUnitMaster from app/components (the main component)
// Note: This is a wrapper page that uses the EmberUnitMaster component
// The actual EmberUnitMaster is in app/components/EmberUnitMaster.tsx
import EmberUnitMaster from '../../app/components/EmberUnitMaster';

export default function EmberUnitPage() {
  // This page component wraps the EmberUnitMaster component
  // EmberUnitMaster contains all the functionality (tabs, controls, etc.)
  return <EmberUnitMaster />;
}