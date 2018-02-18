/*

   compute ship stat info given (level, stat) pairs.

   ported from https://github.com/Javran/kantour/blob/master/src/Kantour/ShipStat/Core.hs

 */
const _ = require('lodash')

const computeStat = ({baseSt, stDiff}) => level => {
  const lvlBonus = stDiff * level / 99
  return baseSt + Math.floor(lvlBonus)
}

const getPossibleStatInfo = (level1, curSt1) => (level2, curSt2) => {
  if (level2 > level1 && curSt2 >= curSt1) {
    const stDiffLower = ((curSt2 - curSt1) - 1) * 99 / (level2 - level1)
    const stDiffUpper = ((curSt2 - curSt1) + 1) * 99 / (level2 - level1)
    const stDiffLowerInt = Math.floor(stDiffLower)
    const stDiffUpperInt = Math.ceil(stDiffUpper)
    const stDiffs = []
    for (let i = stDiffLowerInt; i <= stDiffUpperInt; ++i) {
      if (i >= 0)
        stDiffs.push(i)
    }
    return _.flatMap(stDiffs, stDiff => {
      const baseSt1 = curSt1 - Math.floor((stDiff * level1) / 99)
      const baseSt2 = curSt2 - Math.floor((stDiff * level2) / 99)
      if (baseSt1 >= 0 && baseSt1 == baseSt2) {
        return [{baseSt: baseSt1, stDiff}]
      } else {
        return []
      }
    })
  } else {
    return []
  }
}

const elimStatInfo = (level, stat) =>
  level === 1 ? xs => xs.filter(({baseSt}) => baseSt === stat) :
  level === 99 ? xs => xs.filter(({baseSt, stDiff}) => baseSt+stDiff === stat) :
  xs => xs.filter(si => computeStat(si)(level) === stat)

// note that `pairsObj` is an Object {[level]: stat}
const computeStatInfo = pairsObj => {
  const sortedPairs =
    _.sortBy(
      _.toPairs(pairsObj).map(([lvlStr, stat]) =>
        ({level: Number(lvlStr), stat})
      ),
      'level'
    )

  if (sortedPairs.length < 2) {
    return []
  }

  const {level: levelMin, stat: stMin} = sortedPairs.shift()
  const {level: levelMax, stat: stMax} = sortedPairs.pop()
  const initSearchSpace = getPossibleStatInfo(levelMin, stMin)(levelMax, stMax)
  return sortedPairs.reduce((curSearchSpace, {level,stat}) =>
    elimStatInfo(level,stat)(curSearchSpace),
    initSearchSpace
  )
}

const generateShipStatReport = statRaw =>
  _.mapValues(
    _.groupBy(statRaw, 'id'),
    (shipRawStatReports, shipIdStr) => {
      const evsReports = []
      const aswReports = []
      const losReports = []
      shipRawStatReports.map(({lv, evasion, asw, los}) => {
        evsReports.push({lv, stat: evasion})
        aswReports.push({lv, stat: asw})
        losReports.push({lv, stat: los})
      })

      const keyedReports = {
        evasion: evsReports,
        asw: aswReports,
        los: losReports,
      }

      return _.mapValues(keyedReports, (statReports, statName) => {
        const lvlReports = _.mapValues(
          _.groupBy(statReports, 'lv'),
          (raws, levelStr) => {
            const rs = raws.map(x => x.stat)
            // result of groupBy, must be non-empty
            const stat = rs[0]
            if (rs.length > 1) {
              if (_.tail(stat).every(s => s === stat)) {
                return stat
              } else {
                console.error(`inconsistent stat found for ship ${shipIdStr}, stat ${statName}, level ${levelStr}`)
                return null
              }
            } else {
              return stat
            }
          }
        )
        const pairsObj = _.fromPairs(
          _.toPairs(lvlReports).filter((_lvlStr, stat) => _.isNumber(stat))
        )
        return computeStatInfo(pairsObj).map(({baseSt, stDiff}) => ({base: baseSt, max: baseSt+stDiff}))
      })
    }
  )

exports.generateShipStatReport = generateShipStatReport