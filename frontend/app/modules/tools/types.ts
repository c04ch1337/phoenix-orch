/**
 * Tools Arsenal Types
 * 
 * Type definitions for Phoenix ORCH's eternal tool arsenal.
 */

export interface ToolInfo {
    id: string;
    name: string;
    version: string;
    description: string;
    hitm_level: string;
    last_used?: string;
}

export interface ToolParams {
    [key: string]: any;
}

export interface ToolOutput {
    success: boolean;
    data: any;
    message: string;
    warnings: string[];
    metadata: { [key: string]: string };
}

export interface ToolCallRequest {
    name: string;
    params: ToolParams;
}

export interface ToolCallResponse {
    call_id: string;
    tool_name: string;
    status: string;
    message: string;
    requires_approval: boolean;
    timestamp: string;
}

export interface ToolRegisterRequest {
    github_repo: string;
    name?: string;
}

export interface ToolRegisterResponse {
    tool_id: string;
    name: string;
    status: string;
    message: string;
    timestamp: string;
}

export type HitmLevel = 'None' | 'Low' | 'Medium' | 'High' | 'Critical';

