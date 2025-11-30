'use client';

import React from 'react';
import '../globals.css';

export default function TestCovenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Phoenix Triple-Click Test</title>
      </head>
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}