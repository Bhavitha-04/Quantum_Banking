import React from 'react';
import { BankAccount, BankUser } from '../types/quantum';
import { CurrencyCode, CURRENCIES, SUPPORTED_CURRENCY_CODES } from '../lib/currency';
import { RefreshCw, LogOut, Globe } from 'lucide-react';

export type NavTab = 'banking' | 'quantum' | 'security' | 'verification' | 'tests';

interface HeaderProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  accounts: BankAccount[];
  activeAccountId: string;
  onSelectAccount: (accountId: string) => void;
  onResetLedger: () => void;
  globalCurrency: CurrencyCode | 'AUTO';
  onSelectCurrency: (currency: CurrencyCode | 'AUTO') => void;
  currentUser: BankUser | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  accounts,
  activeAccountId,
  onSelectAccount,
  onResetLedger,
  globalCurrency,
  onSelectCurrency,
  currentUser,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => onSelectTab('banking')}
          className="text-lg font-bold tracking-tight text-white flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>QuantumBank</span>
        </button>

        {/* Zone 2: 4-6 text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => onSelectTab('banking')}
            className={`transition-colors pb-0.5 whitespace-nowrap ${
              activeTab === 'banking'
                ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Banking
          </button>
          <button
            onClick={() => onSelectTab('quantum')}
            className={`transition-colors pb-0.5 whitespace-nowrap ${
              activeTab === 'quantum'
                ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Quantum Console
          </button>
          <button
            onClick={() => onSelectTab('security')}
            className={`transition-colors pb-0.5 whitespace-nowrap ${
              activeTab === 'security'
                ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Security Audit
          </button>
          <button
            onClick={() => onSelectTab('verification')}
            className={`transition-colors pb-0.5 whitespace-nowrap ${
              activeTab === 'verification'
                ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Verification
          </button>
          <button
            onClick={() => onSelectTab('tests')}
            className={`transition-colors pb-0.5 whitespace-nowrap ${
              activeTab === 'tests'
                ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Test Suite
          </button>
        </nav>

        {/* Zone 3: Primary Actions (Currency Selector, Account Switcher, Logout) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Global Currency Selector */}
          <div className="relative" title="Global Display Currency Converter">
            <select
              value={globalCurrency}
              onChange={(e) => onSelectCurrency(e.target.value as CurrencyCode | 'AUTO')}
              className="appearance-none bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg pl-2 pr-6 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="AUTO">🌐 Native</option>
              {SUPPORTED_CURRENCY_CODES.map(code => (
                <option key={code} value={code}>
                  {CURRENCIES[code].flag} {code} ({CURRENCIES[code].symbol})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Active Account Switcher */}
          <div className="relative">
            <select
              value={activeAccountId}
              onChange={(e) => onSelectAccount(e.target.value)}
              className="appearance-none bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer pr-6 max-w-[140px] sm:max-w-[180px] truncate"
            >
              {accounts.map(acc => (
                <option key={acc.accountNumber} value={acc.accountNumber}>
                  {acc.holderName} ({CURRENCIES[acc.currency]?.symbol || '$'})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Reset Demo State Button */}
          <button
            onClick={onResetLedger}
            title="Reset ledger to demo seed state"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg border border-slate-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Logout Button */}
          {currentUser && (
            <button
              onClick={onLogout}
              title={`Logged in as ${currentUser.username} - Click to logout`}
              className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg border border-rose-900/60 transition-colors flex items-center gap-1.5 font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
