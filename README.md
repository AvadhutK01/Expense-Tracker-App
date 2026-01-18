# 💰 Expense Tracker Application

![MERN Stack](https://img.shields.io/badge/Stack-MERN-blue.svg?style=for-the-badge)
![License](https://img.shields.io/badge/license-ISC-green.svg?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Development-orange.svg?style=for-the-badge)

Welcome to the **Complete Expense Tracker Solution**! This project is a feature-rich, full-stack application built using the MERN stack technologies (MongoDB, Express, React Native/Expo, Node.js). It provides a seamless experience for tracking expenses, managing categories, and handling recurring payments.

---

## 🌟 Key Features

- **📊 Expense Tracking**: Detailed transaction logging to keep track of every penny.
- **📂 Category Management**: Create and manage custom categories for better organization.
- **🔄 Recurring Payments**: Set up and track recurring categories and expenses.
- **💸 Auto Debit**: Manage auto-debit transactions automatically.
- **📝 Notes**: Add notes to write down expenses.
- **📱 Mobile First**: Built with React Native and Expo for a smooth mobile experience.

---

## 🏗️ Project Structure

```bash
.
├── 📂 backend         # Node.js & Express API (TypeScript)
│   ├── 📂 src
│   │   ├── 📂 controllers # Request Handlers
│   │   ├── 📂 models      # Mongoose Schema Definitions (AutoDebit, Categories, etc.)
│   │   ├── 📂 routes      # API Endpoints
│   │   └── 📂 utils       # Utilities
│   └── 📄 package.json    # Backend Dependencies
├── 📂 frontend        # React Native (Expo) Frontend
│   ├── 📂 src
│   │   ├── 📂 components  # Reusable UI Components
│   │   ├── 📂 pages       # Application Screens
│   │   ├── 📂 context     # State Management
│   │   └── 📂 router      # Navigation Configuration
│   └── 📄 package.json    # Frontend Dependencies
└── 📄 README.md       # Project Documentation
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas account or local installation
- Expo Go App (for mobile testing) or Android/iOS Emulator

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AvadhutK01/Expense-Tracker-App.git
   cd ExpenseTrackerApp
   ```

2. **Install Dependencies**
   ```bash
   # Install root (if any), backend, and frontend dependencies
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Environment Variables**
   Create `.env` files in both `backend` and `frontend` directories with necessary configuration (DB_URI, PORT, etc.).

4. **Run the Application**

   **Backend:**
   ```bash
   cd backend
   npm run dev
   ```
   Runs on `http://localhost:5000` (default)

   **Frontend:**
   ```bash
   cd frontend
   npm start
   ```
   Scans the generic QR code with Expo Go or press 'a' for Android / 'i' for iOS emulator.

---

## 🛠️ Tech Stack

| Frontend | Backend | Tools |
| :-- | :-- | :-- |
| React Native (Expo) | Node.js | Mongoose |
| TypeScript | Express | TypeScript |
| React Native Paper | MongoDB | Node Cron |
| Tailwind CSS | Node Cron | Expo |

---

## 📄 License
Distributed under the ISC License. See `LICENSE` for more information.

---
Built with ❤️ by [AvadhutK01](https://github.com/AvadhutK01)
