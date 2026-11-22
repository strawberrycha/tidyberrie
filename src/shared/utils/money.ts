import { z } from '../db/strictValidation'

export const centavos = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER)

export function addCentavos(...amounts: number[]) {
  return amounts.reduce((total, amount) => centavos.parse(total + centavos.parse(amount)), 0)
}
