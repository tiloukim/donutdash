// Team members for digital business cards
// Add new team members here — card available at /card/[slug]

export interface TeamMember {
  slug: string
  name: string
  title: string
  phone: string
  email: string
  location: string
}

export const team: TeamMember[] = [
  {
    slug: 'Tilou',
    name: 'Tilou Kim',
    title: 'Founder',
    phone: '9033455599',
    email: 'Donutdash903@gmail.com',
    location: 'Tyler, Texas',
  },
  {
    slug: 'saray',
    name: 'Saray Tem',
    title: 'Operations Manager',
    phone: '6264919094',
    email: 'Saraytem@donutdash.app',
    location: 'Tyler, Texas',
  },
]

export function getTeamMember(slug: string): TeamMember | undefined {
  return team.find(m => m.slug.toLowerCase() === slug.toLowerCase())
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  return phone
}
