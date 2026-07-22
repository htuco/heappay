const CURRENCY_META = {
  AUD: { country: 'AU', symbol: 'A$', name: 'Australian Dollar' },
  BAM: { country: 'BA', symbol: 'KM', name: 'Bosnia-Herzegovina Mark' },
  BRL: { country: 'BR', symbol: 'R$', name: 'Brazilian Real' },
  CAD: { country: 'CA', symbol: 'C$', name: 'Canadian Dollar' },
  CHF: { country: 'CH', symbol: 'Fr', name: 'Swiss Franc' },
  CNY: { country: 'CN', symbol: '¥', name: 'Chinese Yuan' },
  CZK: { country: 'CZ', symbol: 'Kč', name: 'Czech Koruna' },
  DKK: { country: 'DK', symbol: 'kr', name: 'Danish Krone' },
  EUR: { country: 'EU', symbol: '€', name: 'Euro' },
  GBP: { country: 'GB', symbol: '£', name: 'British Pound' },
  HKD: { country: 'HK', symbol: 'HK$', name: 'Hong Kong Dollar' },
  HUF: { country: 'HU', symbol: 'Ft', name: 'Hungarian Forint' },
  IDR: { country: 'ID', symbol: 'Rp', name: 'Indonesian Rupiah' },
  ILS: { country: 'IL', symbol: '₪', name: 'Israeli Shekel' },
  INR: { country: 'IN', symbol: '₹', name: 'Indian Rupee' },
  ISK: { country: 'IS', symbol: 'kr', name: 'Icelandic Króna' },
  JPY: { country: 'JP', symbol: '¥', name: 'Japanese Yen' },
  KRW: { country: 'KR', symbol: '₩', name: 'South Korean Won' },
  MXN: { country: 'MX', symbol: 'Mex$', name: 'Mexican Peso' },
  MYR: { country: 'MY', symbol: 'RM', name: 'Malaysian Ringgit' },
  NOK: { country: 'NO', symbol: 'kr', name: 'Norwegian Krone' },
  NZD: { country: 'NZ', symbol: 'NZ$', name: 'New Zealand Dollar' },
  PHP: { country: 'PH', symbol: '₱', name: 'Philippine Peso' },
  PLN: { country: 'PL', symbol: 'zł', name: 'Polish Złoty' },
  RON: { country: 'RO', symbol: 'lei', name: 'Romanian Leu' },
  SEK: { country: 'SE', symbol: 'kr', name: 'Swedish Krona' },
  SGD: { country: 'SG', symbol: 'S$', name: 'Singapore Dollar' },
  THB: { country: 'TH', symbol: '฿', name: 'Thai Baht' },
  TRY: { country: 'TR', symbol: '₺', name: 'Turkish Lira' },
  USD: { country: 'US', symbol: '$', name: 'US Dollar' },
  ZAR: { country: 'ZA', symbol: 'R', name: 'South African Rand' },
}

function flagEmoji(country) {
  if (!country || country.length !== 2) return '🏳️'
  return country
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
}

export function currencyMeta(code) {
  const key = String(code || '').toUpperCase()
  const meta = CURRENCY_META[key]
  if (!meta) {
    return { code: key, country: '', symbol: key, name: key, flag: '🏳️' }
  }
  return { code: key, ...meta, flag: flagEmoji(meta.country) }
}

export function currencySymbol(code) {
  return currencyMeta(code).symbol
}

export function currencyFlag(code) {
  return currencyMeta(code).flag
}

export default CURRENCY_META
