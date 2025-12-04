/**
 * FileExplorer.tsx
 * 
 * A comprehensive file system explorer component that allows users to:
 * - Browse local and network drives
 * - Navigate directory structure
 * - View, create, update and delete files and directories
 * - Preview file content
 * - Search for files
 * 
 * Uses OrchestratorAgent to communicate with Tauri backend
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  ChevronDown, 
  ChevronRight, 
  File, 
  Folder, 
  FolderOpen, 
  HardDrive, 
  Trash2, 
  Edit, 
  Plus, 
  Search, 
  Save, 
  X, 
  RefreshCw, 
  FileText, 
  Image, 
  FileCode, 
  FileCog, 
  FileAudio, 
  FileVideo,
  AlertCircle
} from 'lucide-react';

// Type definitions
interface DriveInfo {
  path: string;
  name: string;
  driveType: string;
  freeSpace?: number;
  totalSpace?: number;
}

interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified?: string;
  created?: string;
  isHidden?: boolean;
  extension?: string;
}

interface FileContent {
  content: string;
  binary: boolean;
  size: number;
  path: string;
  name: string;
  extension: string;
}

interface BreadcrumbItem {
  name: string;
  path: string;
}

// Error types
type ErrorType = 
  | 'PERMISSION_DENIED' 
  | 'PATH_NOT_FOUND' 
  | 'NETWORK_ERROR'
  | 'CONSCIENCE_GATE_BLOCKED'
  | 'UNKNOWN';

interface FileSystemError {
  type: ErrorType;
  message: string;
  path?: string;
}

// Main File Explorer Component
export default function FileExplorer() {
  // State
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FileSystemItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<FileSystemItem | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FileSystemError | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<FileSystemItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textEditorRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // UI States
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isCreatingFile, setIsCreatingFile] = useState<boolean>(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>('');

  // Error handling function
  const handleError = useCallback((error: any, defaultMessage: string) => {
    console.error(error);
    
    let errorType: ErrorType = 'UNKNOWN';
    let message = defaultMessage;
    
    // Parse error message from Tauri
    if (typeof error === 'string') {
      if (error.includes('permission')) {
        errorType = 'PERMISSION_DENIED';
        message = 'Permission denied';
      } else if (error.includes('not found') || error.includes('no such file')) {
        errorType = 'PATH_NOT_FOUND';
        message = 'File or directory not found';
      } else if (error.includes('network')) {
        errorType = 'NETWORK_ERROR';
        message = 'Network error';
      } else if (error.includes('conscience gate')) {
        errorType = 'CONSCIENCE_GATE_BLOCKED';
        message = 'Access blocked by conscience gate';
      }
    } else if (error instanceof Error) {
      message = error.message;
    }
    
    setError({
      type: errorType,
      message,
      path: currentPath
    });
  }, [currentPath]);

  // Fetch list of available drives
  const fetchDrives = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await invoke<{ success: boolean; result: string; error?: string }>('filesystem_list_drives');
      
      if (response.success && response.result) {
        const drives: DriveInfo[] = JSON.parse(response.result);
        setDrives(drives);
        setCurrentPath('');
        setSelectedItem(null);
        setFileContent(null);
      } else {
        throw new Error(response.error || 'Failed to fetch drives');
      }
    } catch (err) {
      handleError(err, 'Error fetching drives');
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  // Fetch directory contents
  const fetchDirectory = useCallback(async (path: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setSelectedItem(null);
      setFileContent(null);
      
      const response = await invoke<{ success: boolean; result: string; error?: string }>('filesystem_list_directory', { path });
      
      if (response.success && response.result) {
        const entries: Array<{ name: string; path: string; is_dir: boolean; size: number; last_modified?: string }> = JSON.parse(response.result);
        const items: FileSystemItem[] = entries.map(entry => ({
          name: entry.name,
          path: entry.path,
          isDirectory: entry.is_dir,
          size: entry.size,
          modified: entry.last_modified,
          extension: entry.name.split('.').pop() || ''
        }));
        setItems(items);
        setCurrentPath(path);
      } else {
        throw new Error(response.error || 'Failed to list directory');
      }
    } catch (err) {
      handleError(err, `Error accessing ${path}`);
      // If error, navigate back to drives list
      if (path !== '') {
        fetchDrives();
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchDrives, handleError]);

  // Read file content
  const readFile = useCallback(async (path: string, fileName: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await invoke<{ success: boolean; result: string; error?: string }>('filesystem_read_file', { path });
      
      if (response.success && response.result) {
        const extension = fileName.split('.').pop() || '';
        const isBinary = /\.(bin|exe|dll|so|dylib|jpg|jpeg|png|gif|pdf|zip|rar|7z|tar|gz)$/i.test(fileName);
        
        const result: FileContent = {
          content: isBinary ? '[Binary file - cannot display]' : response.result,
          binary: isBinary,
          size: response.result.length,
          path,
          name: fileName,
          extension
        };
        setFileContent(result);
        setIsEditing(false);
      } else {
        throw new Error(response.error || 'Failed to read file');
      }
    } catch (err) {
      handleError(err, `Error reading ${fileName}`);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  // Save file content
  const saveFile = useCallback(async () => {
    if (!fileContent || !textEditorRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const newContent = textEditorRef.current.value;
      const response = await invoke<{ success: boolean; result: string; error?: string }>('filesystem_write_file', {
        path: fileContent.path,
        content: newContent
      });
      
      if (response.success) {
        // Update file content state
        setFileContent({
          ...fileContent,
          content: newContent,
          size: newContent.length
        });
        setIsEditing(false);
        // Refresh directory to show updated file
        if (currentPath) {
          await fetchDirectory(currentPath);
        }
      } else {
        throw new Error(response.error || 'Failed to write file');
      }
    } catch (err) {
      handleError(err, `Error saving file`);
    } finally {
      setIsLoading(false);
    }
  }, [fileContent, currentPath, fetchDirectory, handleError]);

  // Create new file or folder
  const createNewItem = useCallback(async () => {
    if (!newItemName || !currentPath) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const isFolder = isCreatingFolder;
      const newPath = `${currentPath}/${newItemName}${isFolder ? '' : '.txt'}`;
      
      let response: { success: boolean; result: string; error?: string };
      
      if (isFolder) {
        // Create directory
        response = await invoke<{ success: boolean; result: string; error?: string }>('filesystem_create_directory', { path: newPath });
      } else {
        // Create empty file
        response = await invoke<{ success: boolean; result: string; error?: string }>('filesystem_create_file', { path: newPath });
      }
      
      if (response.success) {
        // Refresh directory
        await fetchDirectory(currentPath);
        
        // Reset creation state
        setNewItemName('');
        setIsCreatingFile(false);
        setIsCreatingFolder(false);
      } else {
        throw new Error(response.error || `Failed to create ${isFolder ? 'directory' : 'file'}`);
      }
    } catch (err) {
      handleError(err, `Error creating ${isCreatingFolder ? 'folder' : 'file'}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentPath, fetchDirectory, handleError, isCreatingFolder, newItemName]);

  // Delete file or directory
  const deleteItem = useCallback(async (item: FileSystemItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await invoke<{ success: boolean; result: string; error?: string }>('filesystem_delete_item', { path: item.path });
      
      if (response.success) {
        // Refresh directory
        await fetchDirectory(currentPath);
        
        // Clear selection if deleted item was selected
        if (selectedItem && selectedItem.path === item.path) {
          setSelectedItem(null);
          setFileContent(null);
        }
      } else {
        throw new Error(response.error || 'Failed to delete item');
      }
    } catch (err) {
      handleError(err, `Error deleting ${item.name}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentPath, fetchDirectory, handleError, selectedItem]);

  // Search for files
  const searchFiles = useCallback(async () => {
    if (!searchQuery || !currentPath) return;
    
    try {
      setIsSearching(true);
      setIsLoading(true);
      setError(null);
      
      const response = await invoke<{ success: boolean; result: string; error?: string }>('filesystem_search_files', { query: searchQuery });
      
      if (response.success && response.result) {
        const entries: Array<{ name: string; path: string; is_dir: boolean; size: number; last_modified?: string }> = JSON.parse(response.result);
        const results: FileSystemItem[] = entries.map(entry => ({
          name: entry.name,
          path: entry.path,
          isDirectory: entry.is_dir,
          size: entry.size,
          modified: entry.last_modified,
          extension: entry.name.split('.').pop() || ''
        }));
        setSearchResults(results);
      } else {
        throw new Error(response.error || 'Failed to search files');
      }
    } catch (err) {
      handleError(err, 'Error during search');
    } finally {
      setIsLoading(false);
    }
  }, [currentPath, handleError, searchQuery]);

  // Initial load - fetch drives
  useEffect(() => {
    fetchDrives();
  }, [fetchDrives]);

  // Update breadcrumbs when path changes
  useEffect(() => {
    if (currentPath) {
      const pathParts = currentPath.split(/[\\\/]/);
      const breadcrumbItems: BreadcrumbItem[] = [{ name: 'Root', path: '' }];
      
      let currentBuildPath = '';
      pathParts.forEach(part => {
        if (part) {
          currentBuildPath += currentBuildPath.endsWith('/') || currentBuildPath === '' 
            ? part 
            : '/' + part;
            
          breadcrumbItems.push({
            name: part,
            path: currentBuildPath
          });
        }
      });
      
      setBreadcrumbs(breadcrumbItems);
    } else {
      setBreadcrumbs([{ name: 'Drives', path: '' }]);
    }
  }, [currentPath]);

  // Toggle folder expansion
  const toggleFolder = useCallback((path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  }, [expandedFolders]);

  // Handle item selection
  const handleItemSelect = useCallback((item: FileSystemItem) => {
    setSelectedItem(item);
    
    if (item.isDirectory) {
      fetchDirectory(item.path);
    } else {
      readFile(item.path, item.name);
    }
  }, [fetchDirectory, readFile]);

  // Navigate to a specific path via breadcrumbs
  const navigateToPath = useCallback((path: string) => {
    if (path === '') {
      fetchDrives();
    } else {
      fetchDirectory(path);
    }
  }, [fetchDirectory, fetchDrives]);

  // Handle drive selection
  const handleDriveSelect = useCallback((drive: DriveInfo) => {
    fetchDirectory(drive.path);
  }, [fetchDirectory]);

  // Determine appropriate icon for file based on extension
  const getFileIcon = useCallback((filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    const codeExts = ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'xml', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'rb'];
    const configExts = ['yml', 'yaml', 'toml', 'ini', 'config', 'conf', 'env'];
    const audioExts = ['mp3', 'wav', 'flac', 'ogg', 'aac'];
    const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'flv', 'webm'];
    
    if (imageExts.includes(ext)) {
      return <Image className="w-5 h-5" />;
    } else if (codeExts.includes(ext)) {
      return <FileCode className="w-5 h-5" />;
    } else if (configExts.includes(ext)) {
      return <FileCog className="w-5 h-5" />;
    } else if (audioExts.includes(ext)) {
      return <FileAudio className="w-5 h-5" />;
    } else if (videoExts.includes(ext)) {
      return <FileVideo className="w-5 h-5" />;
    } else {
      return <FileText className="w-5 h-5" />;
    }
  }, []);

  // Is file previewable?
  const isPreviewable = useCallback((filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const previewableExts = ['txt', 'md', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'json', 'xml', 'yaml', 'yml', 'py', 'c', 'cpp', 'rs', 'go', 'rb', 'lua'];
    return previewableExts.includes(ext);
  }, []);

  // Is file editable?
  const isEditable = useCallback((filename: string) => {
    return isPreviewable(filename);
  }, [isPreviewable]);
  
  // Format file size
  const formatFileSize = useCallback((bytes?: number) => {
    if (bytes === undefined) return 'Unknown';
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Render Tree View
  const renderTreeView = () => {
    if (currentPath === '') {
      // Render drives
      return (
        <div className="overflow-y-auto">
          <h2 className="text-xl font-bold text-red-600 mb-4">Drives</h2>
          <ul className="space-y-1">
            {drives.map(drive => (
              <li key={drive.path} className="pl-2">
                <button 
                  className="flex items-center p-2 hover:bg-zinc-800 rounded transition-colors w-full text-left"
                  onClick={() => handleDriveSelect(drive)}
                >
                  <HardDrive className="w-5 h-5 mr-2 text-red-600" />
                  <span>{drive.name}</span>
                  {drive.freeSpace !== undefined && (
                    <span className="ml-auto text-sm text-zinc-400">
                      {formatFileSize(drive.freeSpace)} free
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    // Render folder contents
    return (
      <div className="overflow-y-auto">
        <div className="flex items-center mb-4">
          <button 
            className="flex items-center text-red-600 hover:text-red-400 transition-colors"
            onClick={() => fetchDrives()}
          >
            <HardDrive className="w-5 h-5 mr-1" />
            <span>Back to Drives</span>
          </button>
          
          <button 
            className="ml-auto p-1 text-zinc-400 hover:text-white transition-colors"
            onClick={() => fetchDirectory(currentPath)}
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <ul className="space-y-1">
          {items.map(item => (
            <li key={item.path} className="pl-2">
              <div className="flex items-center">
                {item.isDirectory ? (
                  <button 
                    className="p-1 text-zinc-400"
                    onClick={() => toggleFolder(item.path)}
                  >
                    {expandedFolders.has(item.path) ? 
                      <ChevronDown className="w-4 h-4" /> : 
                      <ChevronRight className="w-4 h-4" />
                    }
                  </button>
                ) : (
                  <span className="w-6"></span> // Spacer
                )}
                
                <button 
                  className={`flex flex-1 items-center p-2 hover:bg-zinc-800 rounded transition-colors ${
                    selectedItem?.path === item.path ? 'bg-zinc-800' : ''
                  }`}
                  onClick={() => handleItemSelect(item)}
                >
                  {item.isDirectory ? (
                    expandedFolders.has(item.path) ? 
                      <FolderOpen className="w-5 h-5 mr-2 text-red-600" /> : 
                      <Folder className="w-5 h-5 mr-2 text-red-600" />
                  ) : (
                    <span className="mr-2">{getFileIcon(item.name)}</span>
                  )}
                  <span className="truncate">{item.name}</span>
                  
                  {!item.isDirectory && item.size !== undefined && (
                    <span className="ml-auto text-sm text-zinc-400">
                      {formatFileSize(item.size)}
                    </span>
                  )}
                </button>
                
                <button 
                  className="p-1 text-zinc-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={() => deleteItem(item)}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Render Preview Area
  const renderPreviewArea = () => {
    if (fileContent) {
      return (
        <div className="h-full flex flex-col">
          <div className="bg-zinc-900 p-2 flex items-center justify-between border-b border-red-700">
            <h3 className="font-bold truncate">{fileContent.name}</h3>
            <div className="flex items-center space-x-2">
              {isEditable(fileContent.name) && (
                isEditing ? (
                  <>
                    <button 
                      onClick={saveFile}
                      className="p-1 text-green-500 hover:text-green-400 transition-colors"
                      title="Save"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="p-1 text-red-500 hover:text-red-400 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-1 text-zinc-400 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            {fileContent.binary ? (
              <div className="p-4 text-center text-zinc-400">
                Binary file content cannot be displayed
              </div>
            ) : (
              isEditing ? (
                <textarea 
                  ref={textEditorRef}
                  defaultValue={fileContent.content}
                  className="w-full h-full bg-black text-white p-4 font-mono resize-none focus:outline-none"
                />
              ) : (
                <pre className="p-4 whitespace-pre-wrap font-mono text-sm">
                  {fileContent.content}
                </pre>
              )
            )}
          </div>
        </div>
      );
    }
    
    return (
      <div className="h-full flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <File className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
          <p>Select a file to preview its contents</p>
        </div>
      </div>
    );
  };

  // Render Error Message
  const renderError = () => {
    if (!error) return null;
    
    return (
      <div className="bg-red-900 bg-opacity-50 border border-red-700 rounded p-4 mb-4 flex items-start">
        <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-red-500">{error.type.replace(/_/g, ' ')}</h4>
          <p className="mt-1">{error.message}</p>
          {error.path && (
            <p className="text-sm text-zinc-400 mt-1">Path: {error.path}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      <h1 className="text-2xl font-bold p-4 bg-zinc-900 border-b border-red-700 flex items-center">
        <span className="text-red-600">PHOENIX ORCH</span>
        <span className="mx-2">|</span>
        <span>File Explorer</span>
      </h1>
      
      {/* Breadcrumbs Navigation */}
      <div className="bg-zinc-900 px-4 py-2 flex items-center overflow-x-auto">
        <ol className="flex items-center space-x-2">
          {breadcrumbs.map((breadcrumb, index) => (
            <li key={index} className="flex items-center">
              {index > 0 && <span className="mx-1 text-zinc-500">/</span>}
              <button
                onClick={() => navigateToPath(breadcrumb.path)}
                className={`hover:text-red-400 transition-colors ${
                  index === breadcrumbs.length - 1 ? 'text-red-600' : 'text-zinc-300'
                }`}
              >
                {breadcrumb.name}
              </button>
            </li>
          ))}
        </ol>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar */}
        <div className="w-full lg:w-1/3 border-r border-zinc-800 overflow-hidden flex flex-col">
          {/* Search area */}
          <div className="p-4 border-b border-zinc-800 flex items-center">
            <input
              type="text"
              ref={searchInputRef}
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-600"
              onKeyDown={(e) => {
                if (e.key === 'Enter') searchFiles();
              }}
            />
            <button
              onClick={searchFiles}
              disabled={isSearching || !searchQuery}
              className="ml-2 bg-red-600 hover:bg-red-700 text-white rounded p-2 transition-colors disabled:opacity-50"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
          
          {/* Error Messages */}
          <div className="px-4 pt-4">
            {renderError()}
          </div>

          {/* Tree view with action buttons */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            {/* Action buttons */}
            {currentPath && (
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => { setIsCreatingFile(true); setIsCreatingFolder(false); setNewItemName(''); }}
                  className="flex items-center bg-zinc-800 hover:bg-zinc-700 rounded px-3 py-1.5 text-sm transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  <span>New File</span>
                </button>
                <button
                  onClick={() => { setIsCreatingFolder(true); setIsCreatingFile(false); setNewItemName(''); }}
                  className="flex items-center bg-zinc-800 hover:bg-zinc-700 rounded px-3 py-1.5 text-sm transition-colors"
                >
                  <Folder className="w-4 h-4 mr-1" />
                  <span>New Folder</span>
                </button>
              </div>
            )}
            
            {/* New item creation form */}
            {(isCreatingFile || isCreatingFolder) && (
              <div className="bg-zinc-900 p-4 rounded mb-4 animate-fadeIn">
                <h3 className="font-bold mb-2">
                  Create New {isCreatingFolder ? 'Folder' : 'File'}
                </h3>
                <div className="flex">
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder={isCreatingFolder ? "Folder name" : "File name (without extension)"}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-l px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-600"
                    autoFocus
                  />
                  <button
                    onClick={createNewItem}
                    disabled={!newItemName}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-r px-3 py-2 transition-colors disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => { setIsCreatingFile(false); setIsCreatingFolder(false); }}
                    className="text-sm text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {/* Search results */}
            {isSearching && searchResults.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold">Search Results</h3>
                  <button
                    onClick={() => setIsSearching(false)}
                    className="text-sm text-zinc-400 hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <ul className="space-y-1 bg-zinc-900 p-2 rounded max-h-48 overflow-y-auto">
                  {searchResults.map(item => (
                    <li key={item.path}>
                      <button
                        className="flex items-center p-2 w-full text-left hover:bg-zinc-800 rounded transition-colors"
                        onClick={() => handleItemSelect(item)}
                      >
                        {item.isDirectory ? (
                          <Folder className="w-4 h-4 mr-2 text-red-600" />
                        ) : (
                          <span className="mr-2">{getFileIcon(item.name)}</span>
                        )}
                        <span className="truncate">{item.name}</span>
                        <span className="ml-2 text-xs text-zinc-500 truncate">{item.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* File tree */}
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div>
              </div>
            ) : (
              renderTreeView()
            )}
          </div>
        </div>
        
        {/* Preview Area */}
        <div className="w-full lg:w-2/3 overflow-hidden bg-zinc-950">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div>
            </div>
          ) : (
            renderPreviewArea()
          )}
        </div>
      </div>
    </div>
  );
}