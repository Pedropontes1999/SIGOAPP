import React, { createContext, useContext, useState } from 'react';

const SidebarContext = createContext({
  isOpen: false, open: () => {}, close: () => {},
  obra: null, setObra: () => {},
});

export function SidebarProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [obra, setObra] = useState(null);
  return (
    <SidebarContext.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false), obra, setObra }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
