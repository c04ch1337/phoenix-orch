'use client';

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { 
  Database,
  Key,
  Lock, 
  FileText, 
  Server, 
  Network,
  Filter,
  Download,
  Upload,
  Search,
  TrashIcon,
  Eye,
  EyeOff,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Shield,
  Calendar,
  Tag
} from 'lucide-react';
import { usePhoenixContext } from '../hooks/usePhoenixContext';

// LootVault Context Definition
interface LootVaultContextValue {
  lootItems: LootItem[];
  addLootItem: (item: LootItem) => Promise<string>;
  deleteLootItem: (id: string) => Promise<void>;
  exportLoot: (filtered?: boolean) => Promise<string>;
  importLoot: (jsonData: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  filters: LootFilter;
  updateFilters: (newFilters: Partial<LootFilter>) => void;
  clearFilters: () => void;
  refreshVault: () => Promise<void>;
}

// Create Context
const LootVaultContext = createContext<LootVaultContextValue | undefined>(undefined);

// Hook for using the LootVault context
export const useLootVault = () => {
  const context = useContext(LootVaultContext);
  if (context === undefined) {
    throw new Error('useLootVault must be used within a LootVaultProvider');
  }
  return context;
};

// Types that match our backend
export enum LootType {
  Credentials = 'Credentials',
  NetworkData = 'NetworkData',
  FilesystemData = 'FilesystemData',
  DatabaseData = 'DatabaseData',
  Custom = 'Custom'
}

export interface LootItem {
  id: string;
  lootType: LootType;
  timestamp: string;
  source: string;
  data: string;
  isEncrypted: boolean;
  context?: string;
  tags: string[];
}

export interface LootFilter {
  lootTypes: LootType[];
  source: string;
  searchTerm: string;
  startDate: string | null;
  endDate: string | null;
}

// LootVault Provider Component
export const LootVaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const phoenix = usePhoenixContext();
  const [lootItems, setLootItems] = useState<LootItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Default empty filters
  const [filters, setFilters] = useState<LootFilter>({
    lootTypes: [],
    source: '',
    searchTerm: '',
    startDate: null,
    endDate: null
  });

  // Define fetchLootItems with useCallback to prevent recreation on every render
  const fetchLootItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // This would be a real API call in production
      // For now, we'll simulate a response with mock data if none exists yet
      const response = await fetch('/api/loot/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filters })
      }).catch(() => {
        // If no backend exists yet, return mock data
        // In production, this would correctly throw to the catch block
        return { 
          ok: true, 
          json: async () => generateMockData() 
        } as Response;
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch loot items');
      }
      
      const data = await response.json();
      setLootItems(data);
    } catch (err) {
      console.error('Error fetching loot:', err);
      setError('Failed to load loot vault data');
      // In a real scenario, we would handle authentication errors separately
      // For now, use mock data for development purposes
      setLootItems(generateMockData());
    } finally {
      setIsLoading(false);
    }
  }, [filters, setLootItems, setIsLoading, setError]);

  // Fetch loot on component mount and filter changes
  useEffect(() => {
    fetchLootItems();
  }, [fetchLootItems]);

  const addLootItem = async (item: LootItem): Promise<string> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // This would be a real API call in production
      // const response = await fetch('/api/loot/add', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify(item)
      // });
      
      // if (!response.ok) {
      //   throw new Error('Failed to add loot item');
      // }
      
      // const data = await response.json();
      // await fetchLootItems(); // Refresh the list
      // return data.id;

      // For development, just add locally with a generated ID
      const newItem = {
        ...item,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      };
      
      setLootItems(prev => [...prev, newItem]);
      return newItem.id;
    } catch (err) {
      console.error('Error adding loot item:', err);
      setError('Failed to add loot item');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteLootItem = async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // This would be a real API call in production
      // const response = await fetch(`/api/loot/${id}`, {
      //   method: 'DELETE'
      // });
      
      // if (!response.ok) {
      //   throw new Error('Failed to delete loot item');
      // }
      
      // await fetchLootItems(); // Refresh the list

      // For development, just delete locally
      setLootItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('Error deleting loot item:', err);
      setError('Failed to delete loot item');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const exportLoot = async (filtered = false): Promise<string> => {
    try {
      const dataToExport = filtered ? lootItems : await fetchAllLootItems();
      return JSON.stringify(dataToExport, null, 2);
    } catch (err) {
      console.error('Error exporting loot:', err);
      setError('Failed to export loot data');
      throw err;
    }
  };

  const importLoot = async (jsonData: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const importedItems = JSON.parse(jsonData) as LootItem[];
      
      // This would be a real API call in production
      // const response = await fetch('/api/loot/import', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json'
      //   },
      //   body: jsonData
      // });
      
      // if (!response.ok) {
      //   throw new Error('Failed to import loot data');
      // }
      
      // await fetchLootItems();

      // For development, just add locally
      setLootItems(prev => [...prev, ...importedItems]);
    } catch (err) {
      console.error('Error importing loot data:', err);
      setError('Failed to import loot data. Check your JSON format.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllLootItems = async (): Promise<LootItem[]> => {
    // In a real app, this would fetch all items without filters
    // For now, just return what we have
    return lootItems;
  };

  const updateFilters = (newFilters: Partial<LootFilter>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  };

  const clearFilters = () => {
    setFilters({
      lootTypes: [],
      source: '',
      searchTerm: '',
      startDate: null,
      endDate: null
    });
  };

  const refreshVault = useCallback(async () => {
    await fetchLootItems();
  }, [fetchLootItems]);

  // Generate mock data for development
  const generateMockData = (): LootItem[] => {
    return [
      {
        id: '1',
        lootType: LootType.Credentials,
        timestamp: new Date().toISOString(),
        source: 'Login Portal',
        data: 'username: admin\npassword: s3cr3t',
        isEncrypted: false,
        tags: ['admin', 'web']
      },
      {
        id: '2',
        lootType: LootType.NetworkData,
        timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        source: 'Internal Router 192.168.1.1',
        data: 'SNMP community string: public',
        isEncrypted: false,
        tags: ['network', 'snmp']
      },
      {
        id: '3',
        lootType: LootType.FilesystemData,
        timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        source: '/etc/shadow',
        data: 'root:$6$xyz:18506:0:99999:7:::',
        isEncrypted: true,
        tags: ['linux', 'credentials']
      },
      {
        id: '4',
        lootType: LootType.DatabaseData,
        timestamp: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
        source: 'MySQL Server',
        data: 'Table structure and 50 user records with hashed passwords',
        isEncrypted: true,
        context: 'Extracted during SQL injection test',
        tags: ['database', 'sql-injection']
      }
    ];
  };

  const contextValue: LootVaultContextValue = {
    lootItems,
    addLootItem,
    deleteLootItem,
    exportLoot,
    importLoot,
    isLoading,
    error,
    filters,
    updateFilters,
    clearFilters,
    refreshVault
  };

  return (
    <LootVaultContext.Provider value={contextValue}>
      {children}
    </LootVaultContext.Provider>
  );
};

// LootType Icon mapping
const getLootTypeIcon = (type: LootType) => {
  switch (type) {
    case LootType.Credentials:
      return <Key className="w-4 h-4 text-amber-400" />;
    case LootType.NetworkData:
      return <Network className="w-4 h-4 text-blue-400" />;
    case LootType.FilesystemData:
      return <FileText className="w-4 h-4 text-green-400" />;
    case LootType.DatabaseData:
      return <Database className="w-4 h-4 text-purple-400" />;
    default:
      return <FileText className="w-4 h-4 text-gray-400" />;
  }
};

// LootType color mapping
const getLootTypeColor = (type: LootType) => {
  switch (type) {
    case LootType.Credentials:
      return 'bg-amber-900/20 border-amber-700/30';
    case LootType.NetworkData:
      return 'bg-blue-900/20 border-blue-700/30';
    case LootType.FilesystemData:
      return 'bg-green-900/20 border-green-700/30';
    case LootType.DatabaseData:
      return 'bg-purple-900/20 border-purple-700/30';
    default:
      return 'bg-gray-800 border-gray-700';
  }
};

// Main LootVault component
interface LootVaultProps {
  className?: string;
}

const LootVault: React.FC<LootVaultProps> = ({ className = '' }) => {
  const {
    lootItems,
    addLootItem,
    deleteLootItem,
    exportLoot,
    importLoot,
    isLoading,
    error,
    filters,
    updateFilters,
    clearFilters,
    refreshVault
  } = useLootVault();

  const [showFilters, setShowFilters] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LootItem | null>(null);
  const [newLootData, setNewLootData] = useState<{
    lootType: LootType;
    source: string;
    data: string;
    context?: string;
    tags: string;
  }>({
    lootType: LootType.Credentials,
    source: '',
    data: '',
    context: '',
    tags: ''
  });
  
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [exportData, setExportData] = useState('');
  
  const handleAddLoot = async () => {
    try {
      const newItem: Partial<LootItem> = {
        lootType: newLootData.lootType,
        source: newLootData.source,
        data: newLootData.data,
        context: newLootData.context || undefined,
        tags: newLootData.tags.split(',').map(tag => tag.trim())
      };
      
      await addLootItem(newItem as LootItem);
      
      // Reset form
      setNewLootData({
        lootType: LootType.Credentials,
        source: '',
        data: '',
        context: '',
        tags: ''
      });
    } catch (err) {
      console.error('Failed to add loot item:', err);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportLoot(true); // Export filtered items
      setExportData(data);
      setShowExport(true);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleImport = async () => {
    try {
      await importLoot(importData);
      setImportData('');
      setShowImport(false);
    } catch (err) {
      console.error('Import failed:', err);
    }
  };

  const handleTypeFilterChange = (type: LootType) => {
    let newTypes: LootType[];
    
    if (filters.lootTypes.includes(type)) {
      newTypes = filters.lootTypes.filter(t => t !== type);
    } else {
      newTypes = [...filters.lootTypes, type];
    }
    
    updateFilters({ lootTypes: newTypes });
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleDownloadExport = () => {
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loot-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const lootTypeNames = Object.values(LootType);

  return (
    <div className={`loot-vault ${className}`}>
      {/* Security Banner */}
      <div className="security-banner py-3 px-4 flex items-center justify-between bg-zinc-800">
        <div className="flex items-center space-x-3">
          <Lock className="w-5 h-5 text-red-500" />
          <span className="font-bold text-sm md:text-base tracking-wider text-white">
            LOOT VAULT - SECURE STORAGE
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => refreshVault()}
            disabled={isLoading}
            className="px-3 py-1 text-xs rounded border border-zinc-500 text-zinc-300 hover:bg-zinc-700 flex items-center"
          >
            {isLoading ? (
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            Refresh
          </button>
          
          <Shield className="w-5 h-5 text-red-500" />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        {/* Filters and Controls */}
        <div className="md:col-span-1">
          <div className="bg-zinc-800 rounded border border-zinc-700 p-4 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-200 flex items-center">
                <Filter className="w-4 h-4 mr-2 text-zinc-400" />
                Filters
              </h3>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="text-zinc-400 hover:text-zinc-300"
              >
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            
            {showFilters && (
              <div className="mt-3 space-y-4">
                {/* Loot Type Filter */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Loot Type</label>
                  <div className="flex flex-wrap gap-2">
                    {lootTypeNames.map(type => (
                      <button
                        key={type}
                        onClick={() => handleTypeFilterChange(type as LootType)}
                        className={`px-2 py-1 text-xs rounded flex items-center ${
                          filters.lootTypes.includes(type as LootType)
                            ? 'bg-red-800 text-white'
                            : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                        }`}
                      >
                        {getLootTypeIcon(type as LootType)}
                        <span className="ml-1">{type}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Source Filter */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Source</label>
                  <input
                    type="text"
                    value={filters.source}
                    onChange={(e) => updateFilters({ source: e.target.value })}
                    placeholder="Filter by source..."
                    className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300"
                  />
                </div>
                
                {/* Date Range */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Date Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={filters.startDate || ''}
                      onChange={(e) => updateFilters({ startDate: e.target.value })}
                      className="bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300"
                    />
                    <input
                      type="date"
                      value={filters.endDate || ''}
                      onChange={(e) => updateFilters({ endDate: e.target.value })}
                      className="bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300"
                    />
                  </div>
                </div>
                
                {/* Search */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Search Term</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={filters.searchTerm}
                      onChange={(e) => updateFilters({ searchTerm: e.target.value })}
                      placeholder="Search in data..."
                      className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 pl-9 text-zinc-300"
                    />
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  </div>
                </div>
                
                {/* Filter Actions */}
                <div className="flex justify-between">
                  <button
                    onClick={clearFilters}
                    className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-sm"
                  >
                    Clear Filters
                  </button>
                  <div className="text-xs text-zinc-500">
                    {lootItems.length} items
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Add New Loot */}
          <div className="bg-zinc-800 rounded border border-zinc-700 p-4">
            <h3 className="text-lg font-semibold text-zinc-200 mb-3">Add New Loot</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Type</label>
                <select
                  value={newLootData.lootType}
                  onChange={(e) => setNewLootData(prev => ({ ...prev, lootType: e.target.value as LootType }))}
                  className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300"
                >
                  {lootTypeNames.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Source</label>
                <input
                  type="text"
                  value={newLootData.source}
                  onChange={(e) => setNewLootData(prev => ({ ...prev, source: e.target.value }))}
                  placeholder="Where was this found?"
                  className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300"
                />
              </div>
              
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Data</label>
                <textarea
                  value={newLootData.data}
                  onChange={(e) => setNewLootData(prev => ({ ...prev, data: e.target.value }))}
                  placeholder="Enter the captured data..."
                  className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300 h-20"
                />
              </div>
              
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Context (Optional)</label>
                <input
                  type="text"
                  value={newLootData.context}
                  onChange={(e) => setNewLootData(prev => ({ ...prev, context: e.target.value }))}
                  placeholder="Any additional context?"
                  className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300"
                />
              </div>
              
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={newLootData.tags}
                  onChange={(e) => setNewLootData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="web,admin,critical"
                  className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300"
                />
              </div>
              
              <button
                onClick={handleAddLoot}
                disabled={!newLootData.source || !newLootData.data}
                className="w-full mt-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add to Vault
              </button>
            </div>
          </div>
          
          {/* Import/Export */}
          <div className="bg-zinc-800 rounded border border-zinc-700 p-4 mt-4">
            <h3 className="text-lg font-semibold text-zinc-200 mb-3">Import/Export</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowImport(!showImport)}
                className="flex items-center justify-center space-x-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded"
              >
                <Upload className="w-4 h-4" />
                <span>Import</span>
              </button>
              
              <button
                onClick={handleExport}
                className="flex items-center justify-center space-x-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
            
            {showImport && (
              <div className="mt-3">
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="Paste JSON data to import..."
                  className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300 h-32 text-xs font-mono"
                />
                <button
                  onClick={handleImport}
                  disabled={!importData.trim()}
                  className="w-full mt-2 px-4 py-2 bg-zinc-600 hover:bg-zinc-500 rounded text-sm disabled:opacity-50"
                >
                  Import Data
                </button>
              </div>
            )}
            
            {showExport && (
              <div className="mt-3">
                <textarea
                  value={exportData}
                  readOnly
                  className="w-full bg-zinc-700 border border-zinc-600 rounded p-2 text-zinc-300 h-32 text-xs font-mono"
                />
                <div className="flex justify-between mt-2">
                  <button
                    onClick={() => setShowExport(false)}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleDownloadExport}
                    className="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 rounded text-sm flex items-center"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Loot Items Grid/Vault Visualization */}
        <div className="md:col-span-2">
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          
          {/* Vault Visualization */}
          <div className="bg-zinc-800 rounded border border-zinc-700 p-4 mb-4">
            <h3 className="text-lg font-semibold text-zinc-200 flex items-center mb-3">
              <Lock className="w-5 h-5 mr-2 text-red-500" />
              Secure Storage
            </h3>
            
            <div className="relative bg-zinc-900 rounded-lg border border-zinc-800 p-4 h-48 overflow-hidden">
              {/* Vault visualization with grid patterns */}
              <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 gap-px opacity-30">
                {Array(48).fill(0).map((_, i) => (
                  <div key={i} className="bg-zinc-700 rounded-sm"></div>
                ))}
              </div>
              
              {/* Category stats */}
              <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { type: LootType.Credentials, label: "Credentials" },
                  { type: LootType.NetworkData, label: "Network" },
                  { type: LootType.FilesystemData, label: "Files" },
                  { type: LootType.DatabaseData, label: "Database" }
                ].map((category) => {
                  const count = lootItems.filter(item => item.lootType === category.type).length;
                  return (
                    <div 
                      key={category.type} 
                      className={`p-3 rounded border ${getLootTypeColor(category.type)} flex flex-col items-center justify-center`}
                    >
                      {getLootTypeIcon(category.type)}
                      <div className="mt-2 text-sm font-medium">{category.label}</div>
                      <div className="text-2xl font-bold mt-1">{count}</div>
                    </div>
                  );
                })}
              </div>
              
              <div className="absolute bottom-3 right-3 text-xs text-zinc-500">
                Total: {lootItems.length} items
              </div>
            </div>
          </div>
          
          {/* Loot Items List */}
          {lootItems.length === 0 ? (
            <div className="bg-zinc-800 rounded border border-zinc-700 p-8 text-center text-zinc-400">
              <Database className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
              <h3 className="text-lg font-medium mb-1">Vault Empty</h3>
              <p className="text-sm">
                No loot items found. Add your first item or import from JSON.
              </p>
            </div>
          ) : (
            <div className="bg-zinc-800 rounded border border-zinc-700">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider hidden md:table-cell">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lootItems.map(item => (
                    <tr 
                      key={item.id} 
                      className="border-b border-zinc-700 hover:bg-zinc-700"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          {getLootTypeIcon(item.lootType)}
                          <span className="ml-2 text-sm">{item.lootType}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-zinc-300">{item.source}</div>
                        <div className="text-xs text-zinc-500 truncate max-w-[200px]">
                          {item.tags.map(tag => `#${tag}`).join(' ')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400 hidden md:table-cell">
                        {formatTimestamp(item.timestamp)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => setSelectedItem(item === selectedItem ? null : item)}
                            className="p-1 rounded hover:bg-zinc-600"
                            title="View Details"
                          >
                            {item === selectedItem ? 
                              <EyeOff className="w-4 h-4 text-zinc-400" /> : 
                              <Eye className="w-4 h-4 text-zinc-400" />
                            }
                          </button>
                          <button
                            onClick={() => deleteLootItem(item.id)}
                            className="p-1 rounded hover:bg-zinc-600"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Selected Item Details */}
          {selectedItem && (
            <div className={`mt-4 p-4 rounded border ${getLootTypeColor(selectedItem.lootType)}`}>
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold flex items-center">
                  {getLootTypeIcon(selectedItem.lootType)}
                  <span className="ml-2">{selectedItem.lootType}</span>
                </h3>
                
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-zinc-400 hover:text-zinc-300"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-3">
                <div className="flex items-center text-sm">
                  <Server className="w-4 h-4 text-zinc-500 mr-2" />
                  <span className="text-zinc-400 mr-1">Source:</span>
                  <span className="text-zinc-200">{selectedItem.source}</span>
                </div>
                
                <div className="flex items-center text-sm">
                  <Calendar className="w-4 h-4 text-zinc-500 mr-2" />
                  <span className="text-zinc-400 mr-1">Date:</span>
                  <span className="text-zinc-200">{formatTimestamp(selectedItem.timestamp)}</span>
                </div>
                
                {selectedItem.context && (
                  <div className="md:col-span-2 flex items-start text-sm mt-1">
                    <Search className="w-4 h-4 text-zinc-500 mr-2 mt-0.5" />
                    <span className="text-zinc-400 mr-1">Context:</span>
                    <span className="text-zinc-200">{selectedItem.context}</span>
                  </div>
                )}
                
                <div className="md:col-span-2 flex items-start text-sm mt-1">
                  <Tag className="w-4 h-4 text-zinc-500 mr-2 mt-0.5" />
                  <span className="text-zinc-400 mr-1">Tags:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-zinc-700 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Data Content</h4>
                <pre className="p-3 bg-zinc-900 rounded border border-zinc-800 text-zinc-300 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {selectedItem.data}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LootVault;