// Calculates platform profit/loss per order across a grid of scenarios.
// Mirrors the live checkout math in app/api/stripe/checkout/route.ts.
//
// Run: npx tsx scripts/profitability-calc.ts
//      npx tsx scripts/profitability-calc.ts --commission=0.25
//      npx tsx scripts/profitability-calc.ts --service-fee=0.15

import {
  SHOP_COMMISSION_RATE,
  DEFAULT_DELIVERY_FEE,
  SERVICE_FEE_RATE,
  BASE_DELIVERY_PAY,
  PER_MILE_PAY,
  BASE_DELIVERY_RADIUS_MILES,
  PER_EXTRA_MILE_FEE,
  MIN_ORDER_AMOUNT,
  SMALL_ORDER_FEE,
  MAX_DELIVERY_MILES,
} from '../lib/constants'

const args = process.argv.slice(2)
function arg(name: string, fallback: number): number {
  const found = args.find(a => a.startsWith(`--${name}=`))
  return found ? parseFloat(found.split('=')[1]) : fallback
}

// Tunable knobs — defaults pulled from production constants.
const COMMISSION         = arg('commission', SHOP_COMMISSION_RATE)
const SERVICE_FEE        = arg('service-fee', SERVICE_FEE_RATE)
const DELIVERY_BASE_FEE  = arg('delivery-base', DEFAULT_DELIVERY_FEE)
const PER_MILE_FEE       = arg('delivery-per-mile', PER_EXTRA_MILE_FEE)
const FREE_MILES         = arg('free-miles', BASE_DELIVERY_RADIUS_MILES)
const TAX_RATE           = arg('tax', 0.0825)                       // Tyler TX
const STRIPE_PCT         = 0.029
const STRIPE_FIXED       = 0.30
const STRIPE_CONNECT_PCT = 0.0025
const STRIPE_CONNECT_FIXED = 0.25
const OPS_PER_ORDER      = arg('ops', 0.50)                         // SaaS/infra/support amortized

function driverPay(distanceMi: number, tip: number): number {
  return BASE_DELIVERY_PAY + distanceMi * PER_MILE_PAY + tip
}

function deliveryFee(distanceMi: number): number {
  const overage = Math.max(0, distanceMi - FREE_MILES)
  return Math.round((DELIVERY_BASE_FEE + overage * PER_MILE_FEE) * 100) / 100
}

interface OrderInput { subtotal: number; distanceMi: number; tip: number }

interface OrderResult {
  customerTotal: number
  shopReceives: number
  driverPay: number
  stripeFees: number
  platformGross: number
  platformNet: number
  customerDeliveryFee: number
  smallOrderFee: number
}

function compute(o: OrderInput): OrderResult {
  const dFee = deliveryFee(o.distanceMi)
  const sFee = Math.round(o.subtotal * SERVICE_FEE * 100) / 100
  const soFee = o.subtotal < MIN_ORDER_AMOUNT ? SMALL_ORDER_FEE : 0
  // TX rule 3.293: tax applies to the food + separately-stated delivery/service/small-order fees.
  const taxableBasis = o.subtotal + dFee + sFee + soFee
  const tax = Math.round(taxableBasis * TAX_RATE * 100) / 100
  const customerTotal = round2(o.subtotal + tax + dFee + sFee + soFee + o.tip)

  // Stripe charges run on the full charge.
  const stripeFees = Math.round((customerTotal * STRIPE_PCT + STRIPE_FIXED) * 100) / 100
  const connectFee = Math.round((customerTotal * STRIPE_CONNECT_PCT + STRIPE_CONNECT_FIXED) * 100) / 100

  // Production model (after platform-fee bug fix): shop's destination charge nets exactly
  // subtotal × (1 - commission). Tax, delivery, service, small-order, tip all stay on platform balance.
  const shopReceives = round2(o.subtotal * (1 - COMMISSION))
  const dPay = driverPay(o.distanceMi, o.tip)

  // Platform absorbs Stripe processing per spec §5.
  const platformGross = customerTotal - shopReceives - dPay - stripeFees - connectFee
  const platformNet = platformGross - OPS_PER_ORDER

  return {
    customerTotal: round2(customerTotal),
    shopReceives,
    driverPay: round2(dPay),
    stripeFees: round2(stripeFees + connectFee),
    platformGross: round2(platformGross),
    platformNet: round2(platformNet),
    customerDeliveryFee: dFee,
    smallOrderFee: soFee,
  }
}

function round2(n: number): number { return Math.round(n * 100) / 100 }

function fmt(n: number): string {
  const s = n.toFixed(2)
  if (n < 0) return `\x1b[31m-$${Math.abs(n).toFixed(2)}\x1b[0m`
  if (n < 1) return `\x1b[33m$${s}\x1b[0m`
  return `\x1b[32m$${s}\x1b[0m`
}

function printHeader() {
  console.log('\nDonutDash per-order profitability — current production parameters:')
  console.log(`  Commission rate:        ${(COMMISSION * 100).toFixed(1)}% (shop pays from food revenue)`)
  console.log(`  Service fee rate:       ${(SERVICE_FEE * 100).toFixed(1)}% (added to customer subtotal)`)
  console.log(`  Delivery fee:           $${DELIVERY_BASE_FEE.toFixed(2)} base for first ${FREE_MILES} mi, +$${PER_MILE_FEE.toFixed(2)}/mi after`)
  console.log(`  Small order fee:        $${SMALL_ORDER_FEE.toFixed(2)} when subtotal < $${MIN_ORDER_AMOUNT}`)
  console.log(`  Driver pay:             $${BASE_DELIVERY_PAY.toFixed(2)} base + $${PER_MILE_PAY.toFixed(2)}/mi + 100% tip`)
  console.log(`  Max delivery distance:  ${MAX_DELIVERY_MILES} mi`)
  console.log(`  Tax rate (Tyler):       ${(TAX_RATE * 100).toFixed(2)}% on (subtotal + delivery + service + small-order)`)
  console.log(`  Stripe processing:      ${(STRIPE_PCT * 100).toFixed(1)}% + $${STRIPE_FIXED.toFixed(2)}  (Connect: ${(STRIPE_CONNECT_PCT * 100).toFixed(2)}% + $${STRIPE_CONNECT_FIXED})`)
  console.log(`  Ops overhead per order: $${OPS_PER_ORDER.toFixed(2)} (SaaS + infra + support amortized)`)
  console.log()
}

function printDetailExample(subtotal: number, distance: number, tip: number) {
  console.log(`\n=== Breakdown — $${subtotal} order, ${distance} mi, $${tip.toFixed(2)} tip ===\n`)
  const r = compute({ subtotal, distanceMi: distance, tip })
  console.log(`  Customer pays:                   $${r.customerTotal.toFixed(2)}`)
  console.log(`    (delivery fee component:       $${r.customerDeliveryFee.toFixed(2)})`)
  if (r.smallOrderFee > 0) console.log(`    (small order fee:              $${r.smallOrderFee.toFixed(2)})`)
  console.log(`  - Shop receives:                 $${r.shopReceives.toFixed(2)}  (${(100 * (1 - COMMISSION)).toFixed(0)}% of food)`)
  console.log(`  - Driver pay (incl tip):         $${r.driverPay.toFixed(2)}`)
  console.log(`  - Stripe fees (proc+connect):    $${r.stripeFees.toFixed(2)}`)
  console.log(`  = Platform gross:                ${fmt(r.platformGross)}`)
  console.log(`  - Ops overhead:                  $${OPS_PER_ORDER.toFixed(2)}`)
  console.log(`  = Platform NET:                  ${fmt(r.platformNet)}`)
}

function printGrid(tip: number) {
  const subtotals = [5, 10, 15, 20, 30, 50]
  // Stay within current MAX_DELIVERY_MILES; sample dense at short distances.
  const distances = [0.5, 1, 1.5, 2, 2.5, 3]

  console.log(`\n=== Tip $${tip.toFixed(2)} — Platform NET profit (after ops overhead) ===\n`)
  process.stdout.write('  Order ↓ \\ Distance →  ')
  for (const d of distances) process.stdout.write(`${String(d + 'mi').padStart(10)}`)
  process.stdout.write('\n')

  for (const s of subtotals) {
    process.stdout.write(`  $${String(s).padStart(4)} subtotal         `)
    for (const d of distances) {
      const r = compute({ subtotal: s, distanceMi: d, tip })
      process.stdout.write(`${fmt(r.platformNet).padStart(22)}`)
    }
    process.stdout.write('\n')
  }
}

function findBreakeven() {
  console.log(`\n=== Loss zones (platform NET < $0 with NO TIP, within ${MAX_DELIVERY_MILES} mi cap) ===\n`)
  const subtotals = [5, 10, 15, 20, 30, 50]
  let any = false
  for (const s of subtotals) {
    let lossAt: number | null = null
    // sweep in 0.25-mi steps for finer-grained breakeven
    for (let d = 0.25; d <= MAX_DELIVERY_MILES + 0.001; d += 0.25) {
      const r = compute({ subtotal: s, distanceMi: d, tip: 0 })
      if (r.platformNet < 0) { lossAt = round2(d); break }
    }
    if (lossAt) {
      console.log(`  $${s} order — starts losing money at ${lossAt} mi (no tip)`)
      any = true
    } else {
      console.log(`  $${s} order — profitable at all distances ✓`)
    }
  }
  if (!any) console.log('  ✓ No loss zones within current delivery range')
}

printHeader()
printDetailExample(15, 2, 3)   // typical
printDetailExample(5, 3, 0)    // worst-case small order, max distance, no tip
printDetailExample(30, 1, 5)   // best-case
printGrid(0)
printGrid(3)
findBreakeven()
console.log('\n')
