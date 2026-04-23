import { scrapeDxbTransactions } from './dist/lib/dxb-interact.js'
const r = await scrapeDxbTransactions({ transactionType: 'sales', limit: 2 })
console.log(r.message)
if (r.results[0]) {
  console.log('sale 0:', JSON.stringify({
    building: r.results[0].building,
    area: r.results[0].area,
    status: r.results[0].status,
    floor: r.results[0].floor,
    unit: r.results[0].unit,
    soldBy: r.results[0].soldBy,
    gain: r.results[0].capitalGainPct,
    price: r.results[0].price,
  }))
}
