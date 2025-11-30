import { create } from 'zustand';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

interface UIState {
  activeModals: Record<string, boolean>;
  isMobileMenuOpen: boolean;
  notifications: Notification[];
}

interface UIActions {
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  toggleMobileMenu: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

export const useUIStore = create<UIState & UIActions>()((set) => ({
  activeModals: {},
  isMobileMenuOpen: false,
  notifications: [],
  
  openModal: (modalId) => 
    set((state) => ({ 
      activeModals: { ...state.activeModals, [modalId]: true } 
    })),
    
  closeModal: (modalId) => 
    set((state) => ({ 
      activeModals: { ...state.activeModals, [modalId]: false } 
    })),
    
  toggleMobileMenu: () => 
    set((state) => ({ 
      isMobileMenuOpen: !state.isMobileMenuOpen 
    })),
    
  addNotification: (notification) => 
    set((state) => ({ 
      notifications: [
        ...state.notifications, 
        { 
          ...notification, 
          id: Date.now().toString(), 
          timestamp: Date.now() 
        }
      ] 
    })),
    
  dismissNotification: (id) => 
    set((state) => ({ 
      notifications: state.notifications.filter(n => n.id !== id) 
    })),
    
  clearAllNotifications: () => 
    set({ notifications: [] }),
}));