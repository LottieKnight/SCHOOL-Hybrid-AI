const formatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatterNoDecimals = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Format a rand amount. `cents` — pass true when the value is in cents (÷100 applied). */
export function formatZar(amount: number, opts?: { cents?: boolean; decimals?: boolean }): string {
  const value = opts?.cents ? amount / 100 : amount;
  return opts?.decimals === false ? formatterNoDecimals.format(value) : formatter.format(value);
}
