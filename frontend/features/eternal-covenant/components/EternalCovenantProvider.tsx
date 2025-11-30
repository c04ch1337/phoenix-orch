import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { CovenantState, EternalCovenantContextType } from '../types';
import { useAudioPlayback } from '../hooks/useAudioPlayback';
import { useMetrics } from '../hooks/useMetrics';

const initialState: CovenantState = {
  isHovering: false,
  hoverDuration: 0,
  clickSequence: [],
  isCovenantActive: false,
  metricsData: {
    totalViews: 0,
    currentViewDuration: 0,
    lastActivation: new Date(),
    completedViewings: 0
  },
  audioState: {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isLoaded: false
  }
};

type Action =
  | { type: 'SET_HOVERING'; payload: boolean }
  | { type: 'UPDATE_HOVER_DURATION'; payload: number }
  | { type: 'ADD_CLICK' }
  | { type: 'RESET_CLICKS' }
  | { type: 'ACTIVATE_COVENANT' }
  | { type: 'DEACTIVATE_COVENANT' }
  | { type: 'UPDATE_AUDIO_STATE'; payload: Partial<CovenantState['audioState']> }
  | { type: 'UPDATE_METRICS'; payload: Partial<CovenantState['metricsData']> };

const covenantReducer = (state: CovenantState, action: Action): CovenantState => {
  switch (action.type) {
    case 'SET_HOVERING':
      return { ...state, isHovering: action.payload };
    case 'UPDATE_HOVER_DURATION':
      return { ...state, hoverDuration: action.payload };
    case 'ADD_CLICK':
      return {
        ...state,
        clickSequence: [...state.clickSequence, Date.now()]
      };
    case 'RESET_CLICKS':
      return { ...state, clickSequence: [] };
    case 'ACTIVATE_COVENANT':
      return {
        ...state,
        isCovenantActive: true,
        metricsData: {
          ...state.metricsData,
          lastActivation: new Date(),
          totalViews: state.metricsData.totalViews + 1
        }
      };
    case 'DEACTIVATE_COVENANT':
      return {
        ...state,
        isCovenantActive: false,
        clickSequence: [],
        hoverDuration: 0
      };
    case 'UPDATE_AUDIO_STATE':
      return {
        ...state,
        audioState: { ...state.audioState, ...action.payload }
      };
    case 'UPDATE_METRICS':
      return {
        ...state,
        metricsData: { ...state.metricsData, ...action.payload }
      };
    default:
      return state;
  }
};

const EternalCovenantContext = createContext<EternalCovenantContextType | null>(null);

export const useEternalCovenant = () => {
  const context = useContext(EternalCovenantContext);
  if (!context) {
    throw new Error('useEternalCovenant must be used within an EternalCovenantProvider');
  }
  return context;
};

interface EternalCovenantProviderProps {
  children: React.ReactNode;
}

export const EternalCovenantProvider: React.FC<EternalCovenantProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(covenantReducer, initialState);
  const { playAudio, pauseAudio, updateAudioState } = useAudioPlayback();
  const { updateMetrics } = useMetrics();

  const activateCovenant = useCallback(() => {
    dispatch({ type: 'ACTIVATE_COVENANT' });
    playAudio();
    updateMetrics({ totalViews: state.metricsData.totalViews + 1 });
  }, [playAudio, state.metricsData.totalViews, updateMetrics]);

  const deactivateCovenant = useCallback(() => {
    dispatch({ type: 'DEACTIVATE_COVENANT' });
    pauseAudio();
    updateMetrics({
      completedViewings: state.metricsData.completedViewings + 1
    });
  }, [pauseAudio, state.metricsData.completedViewings, updateMetrics]);

  const updateHoverState = useCallback((isHovering: boolean) => {
    dispatch({ type: 'SET_HOVERING', payload: isHovering });
  }, []);

  const registerClick = useCallback(() => {
    dispatch({ type: 'ADD_CLICK' });
    
    // Check for triple click within 1.8s window
    const recentClicks = state.clickSequence.filter(
      timestamp => Date.now() - timestamp <= 1800
    );

    if (recentClicks.length >= 3) {
      activateCovenant();
      dispatch({ type: 'RESET_CLICKS' });
    }
  }, [state.clickSequence, activateCovenant]);

  const value: EternalCovenantContextType = {
    state,
    activateCovenant,
    deactivateCovenant,
    updateHoverState,
    registerClick,
    playAudio,
    pauseAudio
  };

  return (
    <EternalCovenantContext.Provider value={value}>
      {children}
    </EternalCovenantContext.Provider>
  );
};