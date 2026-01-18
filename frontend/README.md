# 📱 Expense Tracker - Frontend

![Expo](https://img.shields.io/badge/Expo-4630EB?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

The mobile frontend for the Expense Tracker application, built with **React Native** and **Expo**. This application allows users to easily track their expenses, manage categories, and view transaction history on the go.

## ✨ Features

- **Intuitive UI**: Clean and user-friendly interface using **React Native Paper**.
- **Camera Integration**: Capture receipts or proofs using `expo-camera` (if implemented).
- **Responsive Design**: Styled with `tailwind-react-native-classnames` for consistency.
- **Navigation**: Smooth navigation using React Navigation 7.

## 📦 Dependencies

Major libraries used:
- `expo` & `react-native`
- `axios` for API requests
- `@react-navigation/native` & `@react-navigation/native-stack`
- `react-native-paper` for UI components
- `tailwind-react-native-classnames` for styling

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or newer recommended)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- **Expo Go** app on your physical device, or Android Studio/Xcode for emulators.

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

Start the development server:

```bash
npm start
```

- **Run on physical device**: Scan the QR code with the Expo Go app (Android/iOS).
- **Run on Android Emulator**: Press `a` in the terminal.
- **Run on iOS Simulator**: Press `i` in the terminal (macOS only).
- **Run on Web**: Press `w` in the terminal.

## 📂 Project Structure

- `src/components`: Reusable UI components.
- `src/pages`: Main application screens (Dashboard, Add Expense, etc.).
- `src/context`: React Context for global state management.
- `src/router`: Navigation setup.
- `App.tsx`: Entry point of the application.

## 📝 Scripts

- `npm start`: Start Expo server.
- `npm run android`: Run on Android device/emulator.
- `npm run ios`: Run on iOS simulator.
- `npm run web`: Run in web browser.
