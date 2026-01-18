# 🔙 Expense Tracker - Backend

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

The backend API for the Expense Tracker application. Built with **Node.js**, **Express**, and **TypeScript**, it handles data persistence with **MongoDB** and supports features like auto-debit scheduling.

## 🔑 Key Features

- **RESTful API**: Endpoints for managing categories, transactions, and notes.
- **Data Integrity**: Schema validation using **Mongoose**.
- **Scheduled Tasks**: Automated processes (like auto-debits) using `node-cron`.
- **Type Safety**: Fully typed codebase with **TypeScript**.

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (with Mongoose ODM)
- **Scheduler**: node-cron
- **Language**: TypeScript

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- MongoDB connection string (local or Atlas)

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment:
   Create a `.env` file in the `backend` directory:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   ```

### Running the Server

**Development Mode** (with hot reload):
```bash
npm run dev
```
Allowed API requests on `http://localhost:5000`.

**Production Build**:
```bash
npm run build
npm start
```

## 📂 Project Structure

- `src/models`: Mongoose schemas (AutoDebit, Categories, Notes, RecurringCategories, TransactionLog).
- `src/routes`: API route definitions.
- `src/controllers`: Business logic for requests.
- `src/utils`: Helper functions.
- `src/server.ts`: Server entry point.

## 📜 Scripts

- `npm run dev`: generic nodemon start.
- `npm run build`: Compile TypeScript to JavaScript.
- `npm start`: Run the compiled code from `dist/api.js`.
