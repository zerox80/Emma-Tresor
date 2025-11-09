import React from 'react';

const LoadingScreen: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
    <div className="flex flex-col items-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-brand-400" />
      <p className="text-sm font-medium text-slate-500">EmmaTresor startet …</p>
    </div>
  </div>
);

export default LoadingScreen;
