const _ = require('lodash')
const fetch = require('node-fetch')

const parseDB = data => _(data)
  .split('\n')
  .filter(Boolean)
  .map(content => JSON.parse(content))
  .value()

const getStatAtLv = (start, stop, lv) => Math.floor((stop - start) * (lv / 99)) + start

const main = async () => {
  let stat
  let db
  let $ships
  try {
    const statRes = await fetch('https://poi.0u0.moe/dump/ship-stat.json')
    const statText = await statRes.text()
    stat = parseDB(statText)

    const dbRes = await fetch('https://raw.githubusercontent.com/TeamFleet/WhoCallsTheFleet-DB/master/db/ships.nedb')
    const dbText = await dbRes.text()

    db = _.keyBy(parseDB(dbText), 'id')

    const start2Res = await fetch('http://api.kcwiki.moe/start2')
    const start2 = await start2Res.json()
    $ships = _.keyBy(start2.api_mst_ship, 'api_id')
  } catch (e) {
    console.error(e)
  }

  _.each(stat, ({ id, lv, evasion, evasion_max, asw, asw_max, los, los_max }) => {
    const ship = db[id]
    if (!ship) {
      console.error(`data for ship ${id} not found`)
      return
    }
    const keys = ['evasion_max', 'asw_max', 'los_max']
    if (!_.isEqual({ evasion_max, asw_max, los_max }, _.pick(ship.stat, keys))) {
      console.error(`max data for ship ${id} ${$ships[id].api_name}  not match`)
      return
    }

    const aswLv = getStatAtLv(ship.stat.asw, ship.stat.asw_max, lv)
    const losLv = getStatAtLv(ship.stat.los, ship.stat.los_max, lv)
    const evasionLv = getStatAtLv(ship.stat.evasion, ship.stat.evasion_max, lv)

    if (aswLv !== asw || losLv !== los || evasionLv !== evasion) {
      console.error(`lv stat for ship ${id} ${$ships[id].api_name} not match`, aswLv, asw, ship.stat.asw, losLv, los, ship.stat.los, evasionLv, evasion, ship.stat.evasion)
    }
  })
}

main()
