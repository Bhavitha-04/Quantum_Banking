import React, { useState } from 'react';
import { BankUser } from '../types/quantum';
import { bankingLedger } from '../lib/banking';
import { CurrencyCode, CURRENCIES, formatCurrency, SUPPORTED_CURRENCY_CODES } from '../lib/currency';
import { Lock, ShieldCheck, User, Mail, KeyRound, ArrowRight, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface AuthScreenProps {
  onLoginSuccess: (user: BankUser) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login Form State
  const [loginUsername, setLoginUsername] = useState<string>('bob');
  const [loginPassword, setLoginPassword] = useState<string>('bob123');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Registration Form State
  const [fullName, setFullName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode>('USD');
  const [initialDeposit, setInitialDeposit] = useState<number>(5000);
  const [depositCurrency, setDepositCurrency] = useState<CurrencyCode>('USD');
  const [regError, setRegError] = useState<string | null>(null);

  const demoAccounts = [
    { name: 'Bob Martinez', username: 'bob', password: 'bob123', currency: 'USD' as CurrencyCode, balance: 46200 },
    { name: 'Alice Vance', username: 'alice', password: 'alice123', currency: 'INR' as CurrencyCode, balance: 2500000 },
    { name: 'Charlie Kumar', username: 'charlie', password: 'charlie123', currency: 'USD' as CurrencyCode, balance: 12500 },
  ];

  const handleQuickDemoLogin = (username: string, pass: string) => {
    setLoginUsername(username);
    setLoginPassword(pass);
    setLoginError(null);
    const result = bankingLedger.login(username, pass);
    if (result.success && result.user) {
      onLoginSuccess(result.user);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    try {
      const result = bankingLedger.login(loginUsername, loginPassword);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setLoginError(result.error || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!fullName.trim() || !regUsername.trim() || !regEmail.trim() || !regPassword) {
      setRegError('Please complete all required fields.');
      return;
    }

    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters long.');
      return;
    }

    if (regPassword !== confirmPassword) {
      setRegError('Passwords do not match. Please re-enter.');
      return;
    }

    if (initialDeposit < 0) {
      setRegError('Initial deposit cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = bankingLedger.register({
        fullName,
        username: regUsername,
        email: regEmail,
        passwordPlain: regPassword,
        preferredCurrency,
        initialDeposit,
        depositCurrency,
      });

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setRegError(result.error || 'Registration failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            BB84 Quantum Key Distribution Protected
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            QuantumBank
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Quantum-secure banking transaction simulator with physical-layer eavesdropping detection
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
          {mode === 'login' ? (
            /* LOGIN SCREEN */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  Account Authentication
                </h2>
                <span className="text-[11px] font-mono text-slate-500">PBKDF2-SHA256</span>
              </div>

              {loginError && (
                <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Username
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40"
              >
                <span>Login to QuantumBank</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setLoginError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  New user? <span className="font-semibold underline">Register here</span>
                </button>
              </div>

              {/* Pre-seeded Demo Accounts Hint Box */}
              <div className="mt-5 pt-4 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Demo Accounts (Click to Login)
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">Instant Try</span>
                </div>
                <div className="space-y-1.5">
                  {demoAccounts.map(demo => (
                    <button
                      key={demo.username}
                      type="button"
                      onClick={() => handleQuickDemoLogin(demo.username, demo.password)}
                      className="w-full p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-left transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="text-xs font-medium text-slate-200 group-hover:text-cyan-300 flex items-center gap-1.5">
                          <span>{CURRENCIES[demo.currency].flag}</span>
                          <span>{demo.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({demo.username})</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Password: <code className="text-slate-300">{demo.password}</code>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {formatCurrency(demo.balance, demo.currency)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          ) : (
            /* REGISTRATION SCREEN */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-cyan-400" />
                  New User Registration
                </h2>
                <span className="text-[11px] font-mono text-slate-500">PBKDF2 Salted</span>
              </div>

              {regError && (
                <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{regError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Maya Chen"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="username"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="user@quantumbank.io"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Preferred Currency Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Preferred Base Currency
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {SUPPORTED_CURRENCY_CODES.map(code => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setPreferredCurrency(code);
                        setDepositCurrency(code);
                      }}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-mono transition-colors flex flex-col items-center ${
                        preferredCurrency === code
                          ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-sm">{CURRENCIES[code].flag}</span>
                      <span className="font-bold text-[11px] mt-0.5">{code}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Initial Deposit Amount */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Initial Deposit Amount
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={initialDeposit}
                    onChange={(e) => setInitialDeposit(Number(e.target.value))}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <select
                    value={depositCurrency}
                    onChange={(e) => setDepositCurrency(e.target.value as CurrencyCode)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    {SUPPORTED_CURRENCY_CODES.map(code => (
                      <option key={code} value={code}>
                        {code} ({CURRENCIES[code].symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 px-4 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40"
              >
                <span>Create Account & Start Banking</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setRegError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  Already registered? <span className="font-semibold underline">Login</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
