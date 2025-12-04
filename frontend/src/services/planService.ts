/**
 * Plan Service for interacting with planning API endpoints
 */

import { PlanInfo, PlanStep } from '../components/planner/PlanEditor';

// Fetch plans for a task
export const fetchTaskPlans = async (taskId: string): Promise<PlanInfo[]> => {
  const response = await fetch(`/api/plans/task/${taskId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch plans: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
};

// Fetch a single plan by ID
export const fetchPlan = async (planId: string): Promise<PlanInfo> => {
  const response = await fetch(`/api/plans/${planId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch plan: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
};

// Submit plan feedback (approve all, reject all)
export const submitPlanFeedback = async (
  planId: string, 
  action: 'ApproveAll' | 'RejectAll'
): Promise<void> => {
  const response = await fetch(`/api/plans/${planId}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      user_id: 'human', // Would come from auth context in a real app
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to submit feedback: ${response.status} ${response.statusText}`);
  }
};

// Submit step feedback (modify, skip, change approach)
export const submitStepFeedback = async (
  planId: string,
  stepId: string,
  action: 'ModifyStep' | 'SkipStep' | 'ChangeApproach',
  payload?: string
): Promise<void> => {
  const requestBody: any = {
    user_id: 'human', // Would come from auth context in a real app
    action,
    step_id: stepId,
  };
  
  // Add payload based on action
  if (action === 'ModifyStep') {
    requestBody.description = payload;
  } else if (action === 'ChangeApproach') {
    requestBody.approach = payload;
  }
  
  const response = await fetch(`/api/plans/${planId}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to submit feedback: ${response.status} ${response.statusText}`);
  }
};

// Add a new step
export const addStep = async (
  planId: string,
  afterStepId: string,
  description: string
): Promise<void> => {
  const response = await fetch(`/api/plans/${planId}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: 'human', // Would come from auth context in a real app
      action: 'AddStep',
      after_step_id: afterStepId,
      description,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to add step: ${response.status} ${response.statusText}`);
  }
};

// Connect to SSE events for real-time updates
export const connectToPlanEvents = (): EventSource => {
  const eventSource = new EventSource('/api/plans/stream');
  
  eventSource.onopen = () => {
    console.log('Connected to plans SSE stream');
  };
  
  eventSource.onerror = (error) => {
    console.error('Plans SSE stream error:', error);
  };
  
  return eventSource;
};