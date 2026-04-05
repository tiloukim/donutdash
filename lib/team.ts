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
    slug: 'tony',
    name: 'Tony Kim',
    title: 'Founder',
    phone: '9033455599',
    email: 'Donutdash903@gmail.com',
    location: 'Tyler, Texas',
  },
  // Add more team members:
  // {
  //   slug: 'jane',
  //   name: 'Jane Doe',
  //   title: 'Operations Manager',
  //   phone: '9031234567',
  //   email: 'jane@donutdash.app',
  //   location: 'Tyler, Texas',
  // },
]

export function getTeamMember(slug: string): TeamMember | undefined {
  return team.find(m => m.slug === slug)
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  return phone
}
