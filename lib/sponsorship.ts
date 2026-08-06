// Self-serve sponsorship plans a shop can buy to feature itself. Prices are in
// dollars; `days` is the feature duration; `rank` sets front-page priority
// (higher shows first — admin-curated features can still use a higher rank).

export interface SponsorPlan {
  id: string
  label: string
  days: number
  price: number
  rank: number
  blurb: string
  best?: boolean
}

export const SPONSOR_PLANS: SponsorPlan[] = [
  {
    id: 'week',
    label: '1 Week',
    days: 7,
    price: 25,
    rank: 10,
    blurb: 'Front-page banner + top of the shop list for 7 days.',
  },
  {
    id: 'month',
    label: '1 Month',
    days: 30,
    price: 79,
    rank: 20,
    blurb: 'Everything in Weekly, for a full 30 days.',
    best: true,
  },
  {
    id: 'premium',
    label: '1 Month · Priority',
    days: 30,
    price: 149,
    rank: 50,
    blurb: 'Top banner priority above other sponsors for 30 days.',
  },
]

export function getSponsorPlan(id: string): SponsorPlan | null {
  return SPONSOR_PLANS.find(p => p.id === id) ?? null
}
