import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center bg-gray-100/50 p-12 rounded-lg">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <h3 className="mt-6 text-lg font-semibold text-gray-800">AI Analysis in Progress...</h3>
      <p className="mt-2 text-gray-600 max-w-md text-center">
        Please wait while our engine ingests the document, identifies key patterns, and formulates insights. This may take a moment.
      </p>
    </div>
  );
}
