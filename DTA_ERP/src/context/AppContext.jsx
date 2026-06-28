import { createContext, useState } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const AppContext = createContext();

export function AppProvider({ children }) {
  const [state, setState] = useState({});
  return (
    <AppContext.Provider value={{ state, setState }}>
      {children}
    </AppContext.Provider>
  );
}
