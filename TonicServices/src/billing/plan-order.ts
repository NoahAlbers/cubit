export function sortPlans<T extends {name: string; monthlyCost: number | string}>(plans: T[]): T[] {
  const group = (name: string) => /legacy/i.test(name) ? 2 : /founder|honorary/i.test(name) ? 1 : 0
  return [...plans].sort((a,b) => group(a.name)-group(b.name) ||
    Number(a.monthlyCost)-Number(b.monthlyCost) || a.name.localeCompare(b.name))
}
