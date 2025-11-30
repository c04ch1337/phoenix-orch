'use client';

interface StorageEncProps {
  storage?: number;
}

export default function StorageEnc({ storage = 4.2 }: StorageEncProps) {
  // Determine color based on storage usage (assuming 10PB max capacity)
  const getStorageColor = () => {
    const percentage = (storage / 10) * 100;
    if (percentage < 50) return 'text-blue-500';
    if (percentage < 75) return 'text-yellow-500';
    if (percentage < 90) return 'text-orange-500';
    return 'text-red-600';
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <span className="text-zinc-400">STORAGE (ENC)</span>
      </div>
      <div className="flex items-center">
        <span className={`font-bold ${getStorageColor()}`}>{storage.toFixed(1)}</span>
        <span className="text-zinc-600 ml-1">PB</span>
      </div>
    </div>
  );
}