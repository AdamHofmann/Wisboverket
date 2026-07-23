// Övre tak för listhämtningar. Skyddar mot att någonsin hämta/rendera tiotusentals
// rader på en gång. Listsidorna söker/filtrerar klientsidan över de hämtade raderna,
// så taket är satt högt (år av data ryms) och sidan visar en synlig notis om det
// någonsin nås — ingen tyst avkortning. Vid den volymen är nästa steg riktig
// server-paginering (se [[project_prestanda_pass2]]).
export const LISTA_MAX = 1000
