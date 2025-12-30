# Credit Records Manager

A complete solution to manage bank transactions and sync with Vyapar. No AI dependency - simple manual entry and CSV import.

## Features

- ✅ **Manual Entry** - Add transactions one by one through a form
- ✅ **CSV Upload** - Bulk import transactions from bank statement CSV files
- ✅ **Transaction List** - View all transactions with filters (type, category, Vyapar sync status)
- ✅ **Reconciliation Page** - Mark transactions as "entered in Vyapar" to track what's pending
- ✅ **Party Management** - Track customers and suppliers with balances
- ✅ **Dashboard** - Overview with total credits, debits, net balance, and pending sync count

## Key Features

- No AI dependency - simple manual entry and CSV import
- Review and edit transactions before saving
- Track which transactions are entered in Vyapar
- Filter and search transactions
- Mobile responsive with sidebar navigation
- Beautiful UI with color-coded transaction types (green for credits, red for debits)

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

The app will be available at `http://127.0.0.1:8082`

### Build

Build for production:

```bash
npm run build
```

### Preview

Preview the production build:

```bash
npm run preview
```

## Workflow

1. Add transactions manually OR upload CSV from bank
2. Review and categorize
3. Save to database (localStorage)
4. Enter in Vyapar manually
5. Check "In Vyapar" checkbox to mark as done

This eliminates your Excel tagging step and keeps everything organized in one place!

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Router** - Routing
- **React Hook Form** - Form management
- **PapaParse** - CSV parsing
- **date-fns** - Date utilities
- **Lucide React** - Icons

## Project Structure

```
add-credit-trans/
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx          # Navigation sidebar
│   │   └── ui/                   # Reusable UI components
│   ├── pages/
│   │   ├── Dashboard.tsx         # Overview dashboard
│   │   ├── ManualEntry.tsx       # Manual transaction entry
│   │   ├── CSVUpload.tsx         # CSV import
│   │   ├── Transactions.tsx     # Transaction list
│   │   ├── Reconciliation.tsx   # Vyapar sync tracking
│   │   └── Parties.tsx          # Party management
│   ├── services/
│   │   ├── storageService.ts     # LocalStorage management
│   │   └── csvParser.ts          # CSV parsing logic
│   ├── types/
│   │   └── transaction.ts        # TypeScript types
│   ├── lib/
│   │   └── utils.ts              # Utility functions
│   ├── App.tsx                   # Main app with routing
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles
├── index.html                    # HTML template
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── vite.config.ts                # Vite config
└── tailwind.config.ts            # Tailwind config
```

## Documentation

See [QUICK_START.md](./QUICK_START.md) for detailed usage instructions.

## Data Storage

Currently uses **localStorage** (browser storage). Data is stored locally in your browser.

**Future Enhancement:** Google Sheets integration (like your other projects) for cloud sync and sharing.

