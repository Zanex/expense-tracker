# Expense Tracker

A modern, full-stack financial management application built with the T3 Stack. Track your daily expenses and monitor your investment portfolio in one place.

## ✨ Features

- **Expense Management**: Log, categorize, and track daily spending with custom categories.
- **Investment Portfolio**:
  - Track stocks and assets with real-time data from **Yahoo Finance**.
  - Support for **ISIN** and ticker symbols.
  - **Asset Allocation**: Interactive charts showing your portfolio distribution.
  - **Transaction History**: Track buys, sells, and dividends.
  - **Bulk Import**: Import investment data from CSV files.
- **Trip Tracking**:
  - Group expenses by specific trips or projects.
  - **Trip Analytics**: Dedicated KPIs, category charts, and spending timelines for each trip.
- **Reporting & Insights**: Detailed monthly and yearly reports on spending habits and net worth.
- **Dashboard**: A comprehensive overview of your financial health, including recent transactions and investment performance.
- **Categories**: Manage and customize expense categories to suit your needs.
- **Multi-Device Sync**: Secure authentication and cloud storage to access your data anywhere.


## 🚀 Tech Stack

- **Framework**: [Next.js](https://nextjs.org) (App Router)
- **Database**: [Prisma](https://prisma.io) with PostgreSQL
- **Styling**: [Tailwind CSS](https://tailwindcss.com) & [shadcn/ui](https://ui.shadcn.com)
- **API**: [tRPC](https://trpc.io)
- **Authentication**: [NextAuth.js](https://next-auth.js.org)

## 🛠️ Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   Create a `.env` file based on `.env.example` and provide your database URL and authentication secrets.

3. **Database Migration**:
   ```bash
   npx prisma db push
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

## 📈 Investments
The app uses `yahoo-finance2` to fetch latest market prices. Ensure your assets have valid symbols or ISINs for accurate tracking.

---
*Built with ugh and grugnito.*


