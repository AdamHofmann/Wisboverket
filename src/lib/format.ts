export function normalizeSwedishPhone(to: string) {
  let phone = String(to).replace(/[\s\-()]/g, '')
  if (phone.startsWith('0')) phone = '+46' + phone.slice(1)
  if (!phone.startsWith('+')) phone = '+46' + phone
  return phone
}

export function formatOrgnr(o: string) {
  const d = (o || '').replace(/[^0-9]/g, '')
  return d.length === 10 ? d.slice(0, 6) + '-' + d.slice(6) : o || ''
}
