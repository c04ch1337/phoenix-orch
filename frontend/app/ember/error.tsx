'use client';

import React from 'react';
import RouteError from '../../components/RouteError';

export default function EmberError() {
  return (
    <RouteError
      title="Ember Unit Error"
      message="The Ember Unit has encountered an operational error. System stability may be compromised."
      returnPath="/"
      returnText="Return to Core Systems"
    />
  );
}