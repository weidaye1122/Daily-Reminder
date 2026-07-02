import { createContext, useContext } from 'react';
import type { AuthUser } from '@shared/types';

export interface AppContextValue {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('AppContext is not available');
  }
  return context;
};
