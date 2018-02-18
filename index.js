const _ = require('lodash')
const fetch = require('node-fetch')
const HttpsProxyAgent = require('https-proxy-agent')

const proxy = process.env.https_proxy || process.env.http_proxy || ''
const fetchOptions = {}
fetchOptions.agent = proxy ? new HttpsProxyAgent(proxy) : null

const parseDB = data => _(data)
  .split('\n')
  .filter(Boolean)
  .map(content => JSON.parse(content))
  .value()

const getStatAtLv = (start, stop, lv) => Math.floor(((stop - start) * lv) / 99) + start

const main = async () => {
  let stat
  let db
  let $ships
  let shipStatReport
  try {
    const statRes = await fetch('https://poi.0u0.moe/dump/ship-stat.json', fetchOptions)
    const statText = await statRes.text()
    stat = parseDB(statText)

    const dbRes = await fetch('https://raw.githubusercontent.com/TeamFleet/WhoCallsTheFleet-DB/master/db/ships.nedb', fetchOptions)
    const dbText = await dbRes.text()

    db = _.keyBy(parseDB(dbText), 'id')

    const start2Res = await fetch('http://api.kcwiki.moe/start2', fetchOptions)
    const start2 = await start2Res.json()
    $ships = _.keyBy(start2.api_mst_ship, 'api_id')

    shipStatReport = await (await fetch('https://gist.githubusercontent.com/Javran/31837860b6aa61908a1460a5561a99b6/raw/ship-stat-report.json', fetchOptions)).json()
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
      console.error(`lv stat for ship ${id} ${$ships[id].api_name} lv${lv} not match`, 'ASW', aswLv, asw, ship.stat.asw, 'LoS', losLv, los, ship.stat.los, 'Evasion', evasionLv, evasion, ship.stat.evasion)
    }
  })

  console.log('==== BEGIN SHIP_STAT_REPORT ====')
  const dbMissingIds = []
  const reportInsufficientIds = []
  const reportInconsistentResults = []
  const getShipName = mstId => `${$ships[mstId].api_name} (${mstId})`
  // iterate through all master ids in ascending order
  _.sortBy(
    _.values($ships).map(x => x.api_id).filter(x => x <= 1500),
    _.identity
  ).map(mstId => {
    const shipName = getShipName(mstId)
    const dbShip = db[mstId]
    const statReport = shipStatReport[mstId]
    if (_.isEmpty(dbShip)) {
      dbMissingIds.push(mstId)
      return
    }
    if (_.isEmpty(statReport) || statReport === 'insufficient') {
      reportInsufficientIds.push(mstId)
      return
    }
    const getStat = statName => {
      const {
        [statName]: base,
        [`${statName}_max`]: max,
      } = dbShip.stat
      return {base, max}
    }

    _.words('asw evasion los').map(statName => {
      const dbStat = getStat(statName)
      const possibleStatInfo = statReport[statName]
      const pprStr = ({base, max}) => `(${base}, ${max})`
      if (possibleStatInfo.length === 0) {
        reportInconsistentResults.push({mstId, statName})
        return
      }
      if (!possibleStatInfo.some(si => _.isEqual(si, dbStat))) {
        console.log(`Inconsistency: ship ${shipName}, stat ${statName}`)
        console.log(`  actual: ${pprStr(dbStat)}`)
        console.log(`  expected one of: ${possibleStatInfo.map(pprStr).join(', ')}`)
      }
    })
  })
  const describeIds = xs => xs.map(getShipName).join(', ')
  if (dbMissingIds.length > 0) {
    console.log('Wctf is missing data for following ships:')
    console.log(`  ${describeIds(dbMissingIds)}`)
  }
  if (reportInsufficientIds.length > 0) {
    console.log(`StatReport does not have sufficient data for following ships:`)
    console.log(`  ${describeIds(reportInsufficientIds)}`)
  }
  if (reportInconsistentResults.length > 0) {
    console.log(`StatReport cannot draw a consistent conclusion for following ships and stats`)
    _.mapValues(
      _.groupBy(reportInconsistentResults, 'mstId'),
      (xs, mstIdStr) =>
        console.log(`  ${getShipName(Number(mstIdStr))}: ${xs.map(x => x.statName).join(', ')}`)
    )
  }
  // const reportMissingIds = []
  // const reportInsufficientIds = []
  // const reportInconsistentResults = []
  console.log('==== END SHIP_STAT_REPORT ====')
}

main()
