// Classifies products into Fast / Medium / Slow moving tiers based on
// actual quantity issued (stockOut) within the given period.
// Uses simple tercile ranking: top third = fast, middle third = medium, bottom third = slow.
export function classifyMovement(products, stockOutEntries, sinceDate = null) {
  const moved = {}
  stockOutEntries.forEach((e) => {
    if (sinceDate && e.date?.toDate && e.date.toDate() < sinceDate) return
    moved[e.productId] = (moved[e.productId] || 0) + Number(e.quantity || 0)
  })

  const withMovement = products.map((p) => ({ ...p, moved: moved[p.id] || 0 }))
  const sorted = [...withMovement].sort((a, b) => b.moved - a.moved)

  const n = sorted.length
  const fastCutoff = Math.ceil(n / 3)
  const mediumCutoff = Math.ceil((2 * n) / 3)

  const fast = sorted.slice(0, fastCutoff).filter((p) => p.moved > 0)
  const medium = sorted.slice(fastCutoff, mediumCutoff)
  const slow = [...sorted.slice(mediumCutoff), ...sorted.slice(0, fastCutoff).filter((p) => p.moved === 0)]

  return { fast, medium, slow, ranked: sorted }
}

export function lastNDays(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}
