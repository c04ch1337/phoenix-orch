"use client";

/**
 * NotebookLM Component
 * 
 * This is the main entry point for the NotebookLM feature that follows
 * the module/feature boundary enforcement architecture.
 * It maintains a clean separation of concerns by:
 * 
 * 1. Using business logic exclusively from the NotebookLM module
 * 2. Containing only UI code (no business logic)
 * 3. Properly typed with TypeScript using types from the module
 * 4. Handling only presentation concerns
 */

import NotebookLMComponent from './NotebookLM/index';

export default NotebookLMComponent;