// Port av käll-appens src/lib/parsers.ts.
// Skillnad mot källan: kolumnnamnen är snake_case (f_byggnad-schemat), inte camelCase.
// Käll-appens body kan komma i camelCase (från UI) ELLER snake_case — vi läser båda.

const toInt = (v: unknown) => v !== undefined && v !== null && v !== '' ? parseInt(String(v)) : null
const toFloat = (v: unknown) => v !== undefined && v !== null && v !== '' ? parseFloat(String(v)) : null
const toStr = (v: unknown) => v ? String(v) : null

// pick: läs ett fält från body oavsett camelCase/snake_case-nyckel
const pick = (body: Record<string, unknown>, camel: string, snake: string) =>
  body[camel] !== undefined ? body[camel] : body[snake]

/**
 * Bygger data-objekt för insert/update mot f_byggnad (snake_case-kolumner).
 * Utelämnar beteckning_id om det inte skickats (så update inte nollställer det oavsiktligt).
 */
export function parseByggnadBody(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {
    namn: pick(body, 'namn', 'namn') as string,
    adress: toStr(pick(body, 'adress', 'adress')),
    byggnadsar: toInt(pick(body, 'byggnadsar', 'byggnadsar')),
    ombyggnads_ar: toInt(pick(body, 'ombyggnadsAr', 'ombyggnads_ar')),
    totalyta: toFloat(pick(body, 'totalyta', 'totalyta')),
    uthyrbar_yta: toFloat(pick(body, 'uthyrbarYta', 'uthyrbar_yta')),
    energiklass: toStr(pick(body, 'energiklass', 'energiklass')),
    uppvarmning: toStr(pick(body, 'uppvarmning', 'uppvarmning')),
    hiss: Boolean(pick(body, 'hiss', 'hiss')),
    oljeavskiljare: Boolean(pick(body, 'oljeavskiljare', 'oljeavskiljare')),
    sprinkler: Boolean(pick(body, 'sprinkler', 'sprinkler')),
    laddstolpar: Boolean(pick(body, 'laddstolpar', 'laddstolpar')),
    fiber: Boolean(pick(body, 'fiber', 'fiber')),
    manuellaportar: toInt(pick(body, 'manuellaportar', 'manuellaportar')),
    elportar: toInt(pick(body, 'elportar', 'elportar')),
    beskrivning: toStr(pick(body, 'beskrivning', 'beskrivning')),
  }

  const beteckningId = pick(body, 'beteckningId', 'beteckning_id')
  if (beteckningId !== undefined) {
    data.beteckning_id = beteckningId ? String(beteckningId) : null
  }

  return data
}
