import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import MainRoutes from './src/router/MainRoutes';
import Toast from 'react-native-toast-message';
import { DashboardProvider } from './src/context/DashboardContext';
import { Provider as PaperProvider } from 'react-native-paper';

export default function App() {
  return (
    <>
      <NavigationContainer>
        <DashboardProvider>
          <MainRoutes />
        </DashboardProvider>
      </NavigationContainer>
      <Toast visibilityTime={1500} />
    </>
  );
}
