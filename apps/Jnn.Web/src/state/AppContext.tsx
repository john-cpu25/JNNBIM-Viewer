import { createContext, useContext, type Dispatch } from 'react';
import type { Action, AppState } from './store';
import type { ViewerAdapter } from '../viewer/ViewerAdapter';

export interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  /** Null until the viewport has mounted the adapter. */
  viewer: ViewerAdapter | null;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppContext.Provider>');
  return ctx;
}
