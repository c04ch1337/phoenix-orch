'use client';

import React from 'react';
import RouteError from '../../components/RouteError';

export default function CipherError() {
  return (
    <RouteError
      title="Cipher Guard Error"
      message="The Cipher Guard defense systems have encountered a critical error. Security protocols may be compromised."
      returnPath="/"
      returnText="Return to Secure Core"
    />
  );
}