// Centralized money formatting for the whole app — currency is Dollar.
export function formatMoney(amount) {
  return `$${Number(amount || 0).toFixed(2)}`
}
