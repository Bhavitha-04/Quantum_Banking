/**
 * Multi-Currency Support Module
 * Supports USD ($), INR (₹), EUR (€), GBP (£), JPY (¥)
 * Fixed conversion rates to USD:
 * 1 USD = 83.00 INR
 * 1 USD = 0.92 EUR
 * 1 USD = 0.79 GBP
 * 1 USD = 150.00 JPY
 */

export type CurrencyCode = 'USD' | 'INR' | 'EUR' | 'GBP' | 'JPY';

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  flag: string; // Emoji flag
  ratePerUSD: number; // How many units equal 1 USD
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    flag: '🇺🇸',
    ratePerUSD: 1.0,
    decimals: 2,
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    flag: '🇮🇳',
    ratePerUSD: 83.0,
    decimals: 2,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    flag: '🇪🇺',
    ratePerUSD: 0.92,
    decimals: 2,
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    flag: '🇬🇧',
    ratePerUSD: 0.79,
    decimals: 2,
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    flag: '🇯🇵',
    ratePerUSD: 150.0,
    decimals: 0,
  },
};

export const SUPPORTED_CURRENCY_CODES: CurrencyCode[] = ['USD', 'INR', 'EUR', 'GBP', 'JPY'];

/**
 * Calculates exchange rate from source currency to target currency
 * e.g., 1 INR = (1 / 83) USD = 0.012048 USD
 */
export function getExchangeRate(from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) return 1.0;
  const fromRate = CURRENCIES[from].ratePerUSD;
  const toRate = CURRENCIES[to].ratePerUSD;
  return toRate / fromRate;
}

/**
 * Converts an amount from one currency to another using fixed conversion rates
 */
export function convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) return amount;
  const rate = getExchangeRate(from, to);
  const converted = amount * rate;
  if (CURRENCIES[to].decimals === 0) {
    return Math.round(converted);
  }
  return Math.round(converted * 100) / 100;
}

/**
 * Converts any currency amount to its USD equivalent
 */
export function toUSD(amount: number, from: CurrencyCode): number {
  return convertCurrency(amount, from, 'USD');
}

/**
 * Formats a number with Indian numbering system (Lakhs and Crores)
 * e.g.:
 * 100000 -> "1,00,000"
 * 10000000 -> "1,00,00,000"
 * 1234567.89 -> "12,34,567.89"
 */
export function formatIndianNumber(num: number, includeDecimals = true): string {
  const isNegative = num < 0;
  const abs = Math.abs(num);
  const fixed = abs.toFixed(2);
  const [intPart, decPart] = fixed.split('.');

  let formattedInt = intPart;
  if (intPart.length > 3) {
    const lastThree = intPart.slice(-3);
    const otherDigits = intPart.slice(0, -3);
    const formattedOthers = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedInt = `${formattedOthers},${lastThree}`;
  }

  const sign = isNegative ? '-' : '';
  if (!includeDecimals) {
    return `${sign}${formattedInt}`;
  }
  return `${sign}${formattedInt}.${decPart}`;
}

/**
 * Formats an amount according to currency-specific display standards:
 * - INR: ₹1,23,456.78 (Indian numbering)
 * - USD: $1,234,567.89
 * - EUR: €1.234.567,89 (European numbering)
 * - GBP: £1,234,567.89
 * - JPY: ¥1,234,568 (no decimals)
 */
export function formatCurrency(
  amount: number,
  currencyCode: CurrencyCode,
  options?: { showCode?: boolean; showSymbol?: boolean }
): string {
  const { showCode = false, showSymbol = true } = options || {};
  const curr = CURRENCIES[currencyCode] || CURRENCIES.USD;
  const symbol = showSymbol ? curr.symbol : '';
  const codeSuffix = showCode ? ` ${curr.code}` : '';

  let formattedNum = '';

  switch (currencyCode) {
    case 'INR': {
      formattedNum = formatIndianNumber(amount, true);
      return `${symbol}${formattedNum}${codeSuffix}`;
    }
    case 'JPY': {
      const rounded = Math.round(amount);
      formattedNum = rounded.toLocaleString('en-US');
      return `${symbol}${formattedNum}${codeSuffix}`;
    }
    case 'EUR': {
      // European format: dot for thousands, comma for decimals
      const abs = Math.abs(amount);
      const parts = abs.toFixed(2).split('.');
      const intWithDots = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const sign = amount < 0 ? '-' : '';
      formattedNum = `${sign}${intWithDots},${parts[1]}`;
      return `${symbol}${formattedNum}${codeSuffix}`;
    }
    case 'GBP':
    case 'USD':
    default: {
      const abs = Math.abs(amount);
      const parts = abs.toFixed(2).split('.');
      const intWithCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const sign = amount < 0 ? '-' : '';
      formattedNum = `${sign}${intWithCommas}.${parts[1]}`;
      return `${symbol}${formattedNum}${codeSuffix}`;
    }
  }
}
