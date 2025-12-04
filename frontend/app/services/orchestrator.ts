'use client';

import { invoke } from '@tauri-apps/api/tauri';

/**
 * Represents drive information returned by the filesystem
 */
export interface DriveInfo {
  /** The path to the drive */
  path: string;
  
  /** The name of the drive */
  name: string;
  
  /** The type of drive (e.g., "Fixed", "Removable", "Network") */
  driveType: string;
  
  /** Free space in bytes (optional) */
  freeSpace?: number;
  
  /** Total space in bytes (optional) */
  totalSpace?: number;
}

/**
 * Represents a file system item (file or directory)
 */
export interface FileSystemItem {
  /** The name of the file or directory */
  name: string;
  
  /** The full path to the file or directory */
  path: string;
  
  /** Whether this item is a directory */
  isDirectory: boolean;
  
  /** Size in bytes (for files only) */
  size?: number;
  
  /** Last modified date as string */
  modified?: string;
  
  /** Creation date as string */
  created?: string;
  
  /** Whether this item is hidden */
  isHidden?: boolean;
  
  /** File extension (for files only) */
  extension?: string;
}

/**
 * Represents file content and metadata
 */
export interface FileContent {
  /** The content of the file as string */
  content: string;
  
  /** Whether the file is binary */
  binary: boolean;
  
  /** Size in bytes */
  size: number;
  
  /** Full path to the file */
  path: string;
  
  /** The name of the file */
  name: string;
  
  /** File extension */
  extension: string;
}

/**
 * Error types for filesystem operations
 */
export type FileSystemErrorType = 
  | 'PERMISSION_DENIED' 
  | 'PATH_NOT_FOUND' 
  | 'NETWORK_ERROR'
  | 'CONSCIENCE_GATE_BLOCKED'
  | 'UNKNOWN';

/**
 * Error information for filesystem operations
 */
export interface FileSystemError {
  /** The type of error */
  type: FileSystemErrorType;
  
  /** Error message */
  message: string;
  
  /** Path that caused the error (optional) */
  path?: string;
}

/**
 * Interface for search parameters
 */
export interface SearchParams {
  /** The path to search in */
  path: string;
  
  /** The search query */
  query: string;
}

/**
 * OrchestratorAgent provides a unified interface for all Phoenix Orchestrator operations,
 * including file system operations. This service acts as the frontend client for the
 * backend OrchestratorAgent implemented in Rust.
 */
class OrchestratorAgent {
  /**
   * List available drives on the system
   * 
   * @returns Promise resolving to an array of DriveInfo objects
   * @throws Error if the operation fails
   */
  async listDrives(): Promise<DriveInfo[]> {
    try {
      return await invoke<DriveInfo[]>('filesystem_list_drives');
    } catch (error) {
      console.error('🔥 OrchestratorAgent: Failed to list drives', error);
      throw this.normalizeError(error, 'Failed to list drives');
    }
  }

  /**
   * List files and directories in the specified directory
   * 
   * @param path The path to the directory to list
   * @returns Promise resolving to an array of FileSystemItem objects
   * @throws Error if the operation fails
   */
  async listDirectory(path: string): Promise<FileSystemItem[]> {
    try {
      return await invoke<FileSystemItem[]>('filesystem_list_directory', { path });
    } catch (error) {
      console.error(`🔥 OrchestratorAgent: Failed to list directory ${path}`, error);
      throw this.normalizeError(error, `Failed to list directory: ${path}`);
    }
  }

  /**
   * Read the content of a file
   * 
   * @param path The path to the file to read
   * @returns Promise resolving to a FileContent object
   * @throws Error if the operation fails
   */
  async readFile(path: string): Promise<FileContent> {
    try {
      return await invoke<FileContent>('filesystem_read_file', { path });
    } catch (error) {
      console.error(`🔥 OrchestratorAgent: Failed to read file ${path}`, error);
      throw this.normalizeError(error, `Failed to read file: ${path}`);
    }
  }

  /**
   * Write content to a file
   * 
   * @param path The path to the file to write
   * @param content The content to write to the file
   * @param isDirectory Optional flag to indicate if this is a directory creation
   * @returns Promise resolving to void
   * @throws Error if the operation fails
   */
  async writeFile(path: string, content: string, isDirectory?: boolean): Promise<void> {
    try {
      await invoke('filesystem_write_file', { 
        path, 
        content,
        ...(isDirectory !== undefined && { isDirectory })
      });
    } catch (error) {
      console.error(`🔥 OrchestratorAgent: Failed to write to ${path}`, error);
      throw this.normalizeError(error, `Failed to write to file: ${path}`);
    }
  }

  /**
   * Delete a file or directory
   * 
   * @param path The path to the item to delete
   * @param isDirectory Whether the item is a directory
   * @returns Promise resolving to void
   * @throws Error if the operation fails
   */
  async deleteItem(path: string, isDirectory: boolean): Promise<void> {
    try {
      await invoke('filesystem_delete_item', { path, isDirectory });
    } catch (error) {
      console.error(`🔥 OrchestratorAgent: Failed to delete ${path}`, error);
      throw this.normalizeError(error, `Failed to delete: ${path}`);
    }
  }

  /**
   * Search for files in the given path
   * 
   * @param params Object containing path and query parameters
   * @returns Promise resolving to an array of FileSystemItem objects
   * @throws Error if the operation fails
   */
  async searchFiles(params: SearchParams): Promise<FileSystemItem[]> {
    try {
      return await invoke<FileSystemItem[]>('filesystem_search_files', {
        path: params.path,
        query: params.query
      });
    } catch (error) {
      console.error(`🔥 OrchestratorAgent: Failed to search files in ${params.path}`, error);
      throw this.normalizeError(error, `Failed to search files: ${params.query}`);
    }
  }

  /**
   * Send a task to the OrchestratorAgent
   * 
   * @param goal The goal or task to execute
   * @returns Promise resolving to the result of the task
   * @throws Error if the operation fails
   */
  async executeTask<T = any>(goal: string): Promise<T> {
    try {
      return await invoke<T>('invoke_orchestrator_task', { goal });
    } catch (error) {
      console.error('🔥 OrchestratorAgent: Failed to execute task', error);
      throw this.normalizeError(error, 'Failed to execute task');
    }
  }

  /**
   * Normalize error responses from the backend
   * 
   * @param error The error object or string from the invoke call
   * @param defaultMessage Default message if error cannot be parsed
   * @returns Normalized error object
   */
  private normalizeError(error: any, defaultMessage: string): Error {
    let errorType: FileSystemErrorType = 'UNKNOWN';
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
    
    const fsError: FileSystemError = {
      type: errorType,
      message
    };
    
    // Create a custom error with the FileSystemError attached
    const customError = new Error(message);
    (customError as any).fsError = fsError;
    
    return customError;
  }
}

// Export a singleton instance
export const orchestrator = new OrchestratorAgent();