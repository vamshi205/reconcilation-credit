import { Transaction, Party, DashboardStats } from "../types/transaction";

const STORAGE_KEYS = {
  TRANSACTIONS: "credit_transactions",
  PARTIES: "credit_parties",
} as const;

export class StorageService {
  // Transactions
  static getTransactions(): Transaction[] {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  }

  static saveTransactions(transactions: Transaction[]): void {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }

  static addTransaction(transaction: Transaction): void {
    const transactions = this.getTransactions();
    // Ensure new fields are set
    if (transaction.added_to_vyapar === undefined) {
      transaction.added_to_vyapar = transaction.inVyapar || false;
    }
    transactions.push(transaction);
    this.saveTransactions(transactions);
  }

  static updateTransaction(id: string, updates: Partial<Transaction>): void {
    const transactions = this.getTransactions();
    const index = transactions.findIndex((t) => t.id === id);
    if (index !== -1) {
      const transaction = transactions[index];
      // Migrate legacy inVyapar to added_to_vyapar
      if (transaction.inVyapar !== undefined && transaction.added_to_vyapar === undefined) {
        transaction.added_to_vyapar = transaction.inVyapar;
      }
      transactions[index] = {
        ...transaction,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.saveTransactions(transactions);
    }
  }

  static deleteTransaction(id: string): void {
    const transactions = this.getTransactions();
    const filtered = transactions.filter((t) => t.id !== id);
    this.saveTransactions(filtered);
  }

  // Parties
  static getParties(): Party[] {
    const data = localStorage.getItem(STORAGE_KEYS.PARTIES);
    return data ? JSON.parse(data) : [];
  }

  static saveParties(parties: Party[]): void {
    localStorage.setItem(STORAGE_KEYS.PARTIES, JSON.stringify(parties));
  }

  static addParty(party: Party): void {
    const parties = this.getParties();
    parties.push(party);
    this.saveParties(parties);
  }

  static updateParty(id: string, updates: Partial<Party>): void {
    const parties = this.getParties();
    const index = parties.findIndex((p) => p.id === id);
    if (index !== -1) {
      parties[index] = { ...parties[index], ...updates };
      this.saveParties(parties);
    }
  }

  static deleteParty(id: string): void {
    const parties = this.getParties();
    const filtered = parties.filter((p) => p.id !== id);
    this.saveParties(filtered);
  }

  // Update party balance when transaction is added/updated
  static updatePartyBalance(
    partyName: string,
    amount: number,
    type: "credit" | "debit",
    isNew: boolean = true
  ): void {
    const parties = this.getParties();
    let party = parties.find((p) => p.name.toLowerCase() === partyName.toLowerCase());

    if (!party) {
      // Create new party
      party = {
        id: `party_${Date.now()}`,
        name: partyName,
        type: type === "credit" ? "customer" : "supplier",
        balance: type === "credit" ? amount : -amount,
        totalCredits: type === "credit" ? amount : 0,
        totalDebits: type === "debit" ? amount : 0,
        lastTransactionDate: new Date().toISOString(),
      };
      parties.push(party);
    } else {
      if (isNew) {
        // New transaction
        if (type === "credit") {
          party.balance += amount;
          party.totalCredits += amount;
        } else {
          party.balance -= amount;
          party.totalDebits += amount;
        }
      }
      party.lastTransactionDate = new Date().toISOString();
    }

    this.saveParties(parties);
  }

  // Dashboard Stats
  static getDashboardStats(dateFrom?: string, dateTo?: string): DashboardStats {
    let transactions = this.getTransactions();
    
    // Apply date filter if provided
    if (dateFrom || dateTo) {
      transactions = transactions.filter((t) => {
        const tDate = new Date(t.date);
        if (dateFrom && tDate < new Date(dateFrom)) return false;
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999); // Include entire end date
          if (tDate > toDate) return false;
        }
        return true;
      });
    }

    // Migrate legacy inVyapar to added_to_vyapar
    transactions = transactions.map((t) => {
      if (t.inVyapar !== undefined && t.added_to_vyapar === undefined) {
        t.added_to_vyapar = t.inVyapar;
      }
      return t;
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Only process deposits (credits)
    const depositTransactions = transactions.filter((t) => t.type === "credit");
    
    const totalDepositAmount = depositTransactions.reduce((sum, t) => sum + t.amount, 0);

    const pendingTransactions = depositTransactions.filter(
      (t) => !t.added_to_vyapar && !t.inVyapar
    );
    const pendingAmount = pendingTransactions.reduce((sum, t) => sum + t.amount, 0);
    const pendingCount = pendingTransactions.length;

    const completedTransactions = depositTransactions.filter(
      (t) => (t.added_to_vyapar || t.inVyapar) && t.vyapar_reference_number
    );
    const completedAmount = completedTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Legacy stats
    const totalCredits = depositTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalDebits = transactions
      .filter((t) => t.type === "debit")
      .reduce((sum, t) => sum + t.amount, 0);

    const transactionsThisMonth = transactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= startOfMonth;
    }).length;

    const transactionsThisYear = transactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= startOfYear;
    }).length;

    return {
      totalDepositAmount,
      pendingAmount,
      completedAmount,
      pendingCount,
      totalCredits,
      totalDebits,
      netBalance: totalCredits - totalDebits,
      pendingSyncCount: pendingCount,
      transactionsThisMonth,
      transactionsThisYear,
    };
  }

  // Export/Import
  static exportData() {
    return {
      transactions: this.getTransactions(),
      parties: this.getParties(),
      exportedAt: new Date().toISOString(),
    };
  }

  static importData(data: { transactions: Transaction[]; parties: Party[] }) {
    if (data.transactions) {
      this.saveTransactions(data.transactions);
    }
    if (data.parties) {
      this.saveParties(data.parties);
    }
  }
}

