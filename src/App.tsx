/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Header, NavTab } from './components/Header';
import { AuthScreen } from './components/AuthScreen';
import { BankingDashboard } from './components/BankingDashboard';
import { QuantumConsole } from './components/QuantumConsole';
import { SecurityLog } from './components/SecurityLog';
import { VerificationPortal } from './components/VerificationPortal';
import { TestMetricsView } from './components/TestMetricsView';
import { PythonReferenceModal } from './components/PythonReferenceModal';
import { bankingLedger } from './lib/banking';
import { BankAccount, BankUser } from './types/quantum';
import { CurrencyCode } from './lib/currency';

export default function App() {
  const [currentUser, setCurrentUser] = useState<BankUser | null>(() => bankingLedger.getCurrentUser());
  const [activeTab, setActiveTab] = useState<NavTab>('banking');
  const [globalCurrency, setGlobalCurrency] = useState<CurrencyCode | 'AUTO'>('AUTO');
  const [accounts, setAccounts] = useState<BankAccount[]>(() => bankingLedger.getAccounts());
  const [activeAccountId, setActiveAccountId] = useState<string>(() => {
    const user = bankingLedger.getCurrentUser();
    return user ? user.accountNumber : (bankingLedger.getAccounts()[0]?.accountNumber || 'QB-3309-8812');
  });
  const [verificationTxId, setVerificationTxId] = useState<string | undefined>(undefined);

  const refreshAccounts = () => {
    setAccounts(bankingLedger.getAccounts());
  };

  const handleLoginSuccess = (user: BankUser) => {
    setCurrentUser(user);
    refreshAccounts();
    setActiveAccountId(user.accountNumber);
    setActiveTab('banking');
  };

  const handleLogout = () => {
    bankingLedger.logout();
    setCurrentUser(null);
  };

  const handleResetLedger = () => {
    bankingLedger.resetToDefault();
    const updatedAccounts = bankingLedger.getAccounts();
    setAccounts(updatedAccounts);
    const curr = bankingLedger.getCurrentUser();
    setCurrentUser(curr);
    if (curr) {
      setActiveAccountId(curr.accountNumber);
    } else if (updatedAccounts[0]) {
      setActiveAccountId(updatedAccounts[0].accountNumber);
    }
  };

  const handleSelectTxForVerification = (txId: string) => {
    setVerificationTxId(txId);
    setActiveTab('verification');
  };

  // If user is not authenticated, render Login / Registration Landing Page
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar Navigation (Strict 3-zone contract) */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        accounts={accounts}
        activeAccountId={activeAccountId}
        onSelectAccount={setActiveAccountId}
        onResetLedger={handleResetLedger}
        globalCurrency={globalCurrency}
        onSelectCurrency={setGlobalCurrency}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'banking' && (
          <BankingDashboard
            accounts={accounts}
            activeAccountId={activeAccountId}
            globalCurrency={globalCurrency}
            onRefresh={refreshAccounts}
            onViewAudit={() => setActiveTab('security')}
            onViewQuantumConsole={() => setActiveTab('quantum')}
          />
        )}

        {activeTab === 'quantum' && (
          <QuantumConsole />
        )}

        {activeTab === 'security' && (
          <SecurityLog
            onSelectTxForVerification={handleSelectTxForVerification}
            globalCurrency={globalCurrency}
          />
        )}

        {activeTab === 'verification' && (
          <VerificationPortal
            initialTxId={verificationTxId}
            globalCurrency={globalCurrency}
          />
        )}

        {activeTab === 'tests' && (
          <TestMetricsView />
        )}

        {activeTab === 'code' && (
          <PythonReferenceModal />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-6 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">QuantumBank</span>
            <span>·</span>
            <span>BB84 QKD + AES-256-GCM + HMAC-SHA256 Multi-Currency Engine</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Shor's Algorithm Defense: Quantum Key Distribution</span>
            <span>·</span>
            <span>Status: Nominal</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
