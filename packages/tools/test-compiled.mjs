import { scrapeDxbTransactions } from './dist/lib/dxb-interact.js'
const t0 = Date.now()
const r = await scrapeDxbTransactions({ transactionType: 'sales', limit: 2 })
console.log(`[${((Date.now()-t0)/1000).toFixed(1)}s]`, r.message)
const r2 = await scrapeDxbTransactions({ transactionType: 'rentals', limit: 2 })
console.log(`[${((Date.now()-t0)/1000).toFixed(1)}s]`, r2.message)
console.log('sale 0:', JSON.stringify({ building: r.results[0]?.building, floor: r.results[0]?.floor, unit: r.results[0]?.unit, status: r.results[0]?.status, soldBy: r.results[0]?.soldBy, gain: r.results[0]?.capitalGainPct }))
console.log('rent 0:', JSON.stringify({ building: r2.results[0]?.building, floor: r2.results[0]?.floor, unit: r2.results[0]?.unit, area: r2.results[0]?.area, yield: r2.results[0]?.rentalYield }))
