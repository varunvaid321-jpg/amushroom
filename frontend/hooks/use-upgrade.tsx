"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface UpgradeContextType {
  openUpgrade: () => void;
  closeUpgrade: () => void;
  upgradeOpen: boolean;
}

const UpgradeContext = createContext<UpgradeContextType>({
  openUpgrade: () => {},
  closeUpgrade: () => {},
  upgradeOpen: false,
});

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const openUpgrade = useCallback(() => setUpgradeOpen(true), []);
  const closeUpgrade = useCallback(() => setUpgradeOpen(false), []);

  return (
    <UpgradeContext.Provider value={{ openUpgrade, closeUpgrade, upgradeOpen }}>
      {children}
    </UpgradeContext.Provider>
  );
}

export function useUpgrade() {
  return useContext(UpgradeContext);
}
