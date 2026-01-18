import React, { createContext, useContext, useState, useCallback } from 'react';
import UPIScanner from '../pages/UPIScanner';
import { Modal } from 'react-native';

type DashboardContextType = {
  refreshDashboard: () => void;
  setRefreshDashboard: (callback: () => void) => void;
  showUPIScanner: (amount: string, onFallback?: () => void) => void;
  hideUPIScanner: () => void;
  scannerState: { visible: boolean; amount: string; onFallback?: () => void };
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshCallback, setRefreshCallback] = useState<() => void>(() => () => {});
  const [scannerState, setScannerState] = useState<{ visible: boolean; amount: string; onFallback?: () => void }>({
    visible: false,
    amount: '',
    onFallback: undefined,
  });

  const setRefreshDashboard = (callback: () => void) => {
    setRefreshCallback(() => callback);
  };

  const refreshDashboard = useCallback(() => {
    refreshCallback();
  }, [refreshCallback]);

  const showUPIScanner = (amount: string, onFallback?: () => void) => {
    setScannerState({ visible: true, amount, onFallback });
  };

  const hideUPIScanner = () => {
    setScannerState({ ...scannerState, visible: false });
  };

  return (
    <DashboardContext.Provider
      value={{ refreshDashboard, setRefreshDashboard, showUPIScanner, hideUPIScanner, scannerState }}
    >
      {children}

      {scannerState.visible && (
        <Modal visible transparent animationType="slide">
          <UPIScanner
            amount={scannerState.amount}
            onFallback={() => {
              hideUPIScanner();
              scannerState.onFallback?.();
            }}
            onBack={hideUPIScanner}
          />
        </Modal>
      )}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};
