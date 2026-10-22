import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RANK_URL = "https://mlol.qt.qq.com/go/lgame_battle_info/hero_rank_list_v2";
const CHAMP_URL = "https://game.gtimg.cn/images/lgamem/act/lrlib/js/heroList/hero_list.js";

const RANK_KEYS = ["1", "2", "3", "4"];

const RANK_WEIGHTS: Record<string, number> = {
  "1": 1,
  "2": 1.15,
  "3": 1.35,
  "4": 1.6,
};

const MAX_RANK_WEIGHT = RANK_KEYS.reduce(
  (sum, rankKey) => sum + (RANK_WEIGHTS[rankKey] || 0),
  0,
);

const COMPETITIVE_BASE_FACTOR = 0.50;
const PRESENCE_FACTOR_WEIGHT = 0.20;
const HIGH_RANK_FACTOR_WEIGHT = 0.30;

// Días desde que se activa un parche de número nuevo hasta aplicar la penalización por elos.
const ELO_PENALTY_GRACE_DAYS = 21;

// Promedio por parche ponderado: un día de hace AVERAGE_HALF_LIFE_DAYS pesa la mitad
// que el de hoy, así un nerfeo/buff se refleja en pocos días sin perder estabilidad.
const AVERAGE_HALF_LIFE_DAYS = 3;

// Penalidad por días ausentes: factor = base + (peso de días presente / peso total) × peso.
const DAY_PRESENCE_BASE_FACTOR = 0.60;
const DAY_PRESENCE_FACTOR_WEIGHT = 0.40;

const POSITIONS: Record<string, string> = {
  "1": "mid",
  "2": "top",
  "3": "adc",
  "4": "support",
  "5": "jungler",
};

const METRIC_KEYS = [
  "win_rate_percent",
  "appear_rate_percent",
  "forbid_rate_percent",
];

const DEFAULT_WEIGHTS = {
  winrate: 0.50,
  pickrate: 0.37,
  banrate: 0.08,
  facilidad: 0.05,
};

const DICT_CHAMP: Record<string, string> = {
  "凯尔": "Kayle",
  "莫甘娜": "Morgana",
  "提莫": "Teemo",
  "婕拉": "Zyra",
  "布兰德": "Brand",
  "阿狸": "Ahri",
  "凯南": "Kennen",
  "内瑟斯": "Nasus",
  "安妮": "Annie",
  "斯维因": "Swain",
  "维迦": "Veigar",
  "阿萝拉": "Aurora",
  "奥莉安娜": "Orianna",
  "薇古丝": "Vex",
  "拉克丝": "Lux",
  "永恩": "Yone",
  "崔斯特": "Twisted Fate",
  "黑默丁格": "Heimerdinger",
  "辛德拉": "Syndra",
  "丽桑卓": "Lissandra",
  "维克托": "Viktor",
  "亚索": "Yasuo",
  "弗拉基米尔": "Vladimir",
  "卡萨丁": "Kassadin",
  "维克兹": "Vel'Koz",
  "菲兹": "Fizz",
  "加里奥": "Galio",
  "奥瑞利安·索尔": "Aurelion Sol",
  "瑞兹": "Ryze",
  "吉格斯": "Ziggs",
  "阿卡丽": "Akali",
  "崔丝塔娜": "Tristana",
  "卡特琳娜": "Katarina",
  "艾克": "Ekko",
  "劫": "Zed",
  "黛安娜": "Diana",
  "杰斯": "Jayce",
  "艾瑞莉娅": "Irelia",
  "墨菲特": "Malphite",
  "安蓓萨": "Ambessa",
  "孙悟空": "Wukong",
  "嘉文四世": "Jarvan IV",
  "兰博": "Rumble",
  "莫德凯撒": "Mordekaiser",
  "盖伦": "Garen",
  "诺提勒斯": "Nautilus",
  "辛吉德": "Singed",
  "卡蜜尔": "Camille",
  "波比": "Poppy",
  "慎": "Shen",
  "菲奥娜": "Fiora",
  "奥恩": "Ornn",
  "沃利贝尔": "Volibear",
  "薇恩": "Vayne",
  "纳尔": "Gnar",
  "赛恩": "Sion",
  "贾克斯": "Jax",
  "泰达米尔": "Tryndamere",
  "德莱厄斯": "Darius",
  "瑟提": "Sett",
  "亚托克斯": "Aatrox",
  "蒙多医生": "Dr. Mundo",
  "厄加特": "Urgot",
  "格温": "Gwen",
  "雷克顿": "Renekton",
  "锐雯": "Riven",
  "古拉加斯": "Gragas",
  "厄运小姐": "Miss Fortune",
  "艾希": "Ashe",
  "霞": "Xayah",
  "卢锡安": "Lucian",
  "希维尔": "Sivir",
  "烬": "Jhin",
  "金克丝": "Jinx",
  "韦鲁斯": "Varus",
  "泽丽": "Zeri",
  "库奇": "Corki",
  "凯特琳": "Caitlyn",
  "德莱文": "Draven",
  "莎弥拉": "Samira",
  "伊泽瑞尔": "Ezreal",
  "卡莎": "Kai'Sa",
  "图奇": "Twitch",
  "卡莉丝塔": "Kalista",
  "巴德": "Bardo",
  "布隆": "Braum",
  "基兰": "Zilean",
  "蕾欧娜": "Leona",
  "娜美": "Nami",
  "茂凯": "Maokai",
  "迦娜": "Janna",
  "米利欧": "Milio",
  "赛娜": "Senna",
  "派克": "Pyke",
  "卡尔玛": "Karma",
  "娑娜": "Sona",
  "芮尔": "Rell",
  "索拉卡": "Soraka",
  "布里茨": "Blitzcrank",
  "璐璐": "Lulu",
  "洛": "Rakan",
  "萨勒芬妮": "Seraphine",
  "阿利斯塔": "Alistar",
  "悠米": "Yuumi",
  "锤石": "Thresh",
  "阿木木": "Amumu",
  "莉莉娅": "Lillia",
  "希瓦娜": "Shyvana",
  "拉莫斯": "Rammus",
  "赵信": "Xin Zhao",
  "奈德丽": "Nidalee",
  "沃里克": "Warwick",
  "千珏": "Kindred",
  "努努和威朗普": "Nunu y Willump",
  "蔚": "Vi",
  "潘森": "Pantheon",
  "费德提克": "Fiddlesticks",
  "格雷福斯": "Graves",
  "魔腾": "Nocturne",
  "凯隐": "Kayn",
  "卡兹克": "Kha'Zix",
  "佛耶戈": "Viego",
  "雷恩加尔": "Rengar",
  "易": "Maestro Yi",
  "李青": "Lee Sin",
  "赫卡里姆": "Hecarim",
  "奥拉夫": "Olaf",
  "伊芙琳": "Evelynn",
  "佐伊": "Zoe",
  "尼菈": "Nilah",
  "阿克尚": "Akshan",
  "泰隆": "Talon",
  "斯莫德": "Smolder",
  "奎桑提": "K'Sante",
  "克格莫": "Kog'Maw",
  "诺拉": "Norra",
  "梅尔": "Mel",
  "塔莉垭": "Taliyah",
  "斯卡纳": "Skarner",
  "芸阿娜": "Yunara",
  "科加斯": "Cho'Gath",
  "彗": "Hwei"
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;

  if (typeof value === "string") {
    value = value.replace("%", "").replace(",", ".").trim();
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function weightedAverage(values: Array<{ value: number; weight: number }>) {
  if (!values.length) return 0;

  const weightSum = values.reduce((sum, item) => sum + item.weight, 0);
  if (weightSum <= 0) return 0;

  const total = values.reduce((sum, item) => sum + item.value * item.weight, 0);
  return Number((total / weightSum).toFixed(4));
}

function getChampionMeta(dataChamp: any, heroId: string) {
  const heroList = dataChamp?.heroList || {};
  const heroIdString = String(heroId);

  if (Array.isArray(heroList)) {
    return heroList.find((hero: any) =>
      String(hero?.heroId) === heroIdString ||
      String(hero?.hero_id) === heroIdString ||
      String(hero?.id) === heroIdString
    ) || {};
  }

  return heroList?.[heroIdString] || heroList?.[heroId] || {};
}

function calcPercentile(values: number[]) {
  const n = values.length;

  if (n <= 1) {
    return values.map(() => 0);
  }

  return values.map((v) => {
    const rank = values.filter((x) => x < v).length + 1;
    return Number((((rank - 1) / (n - 1)) * 100).toFixed(2));
  });
}

function assignTier(rankingFinal: number) {
  if (rankingFinal >= 85) return "S+";
  if (rankingFinal >= 70) return "S";
  if (rankingFinal >= 45) return "A";
  if (rankingFinal >= 20) return "B";
  return "C";
}

function getSafeDifficulty(value: unknown) {
  const difficulty = toNumber(value);

  if (!difficulty || difficulty < 1 || difficulty > 3) {
    return 2;
  }

  return difficulty;
}

function getEaseRanking(difficulty: number) {
  return Number(clamp(((3 - difficulty) / 2) * 100, 0, 100).toFixed(2));
}

function normalizeWeights(configPayload: any) {
  const rawWeights = {
    winrate: toNumber(configPayload?.winrate_weight ?? DEFAULT_WEIGHTS.winrate),
    pickrate: toNumber(configPayload?.pickrate_weight ?? DEFAULT_WEIGHTS.pickrate),
    banrate: toNumber(configPayload?.banrate_weight ?? DEFAULT_WEIGHTS.banrate),
    facilidad: toNumber(configPayload?.facilidad_weight ?? DEFAULT_WEIGHTS.facilidad),
  };

  const total = Object.values(rawWeights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return DEFAULT_WEIGHTS;

  return {
    winrate: rawWeights.winrate / total,
    pickrate: rawWeights.pickrate / total,
    banrate: rawWeights.banrate / total,
    facilidad: rawWeights.facilidad / total,
  };
}

function processLane(
  champions: any[],
  weights: ReturnType<typeof normalizeWeights>,
  applyEloPresencePenalty: boolean,
) {
  const n = champions.length;

  if (n === 0) return [];

  const winrates = champions.map((c) => c.win_rate_percent);
  const pickrates = champions.map((c) => c.appear_rate_percent);
  const banrates = champions.map((c) => c.forbid_rate_percent);

  const rankingWinrate = calcPercentile(winrates);
  const rankingPickrate = calcPercentile(pickrates);
  const rankingBanrate = calcPercentile(banrates);

  return champions
    .map((champ, i) => {
      const difficulty = getSafeDifficulty(champ.difficultyL);
      const rankingFacilidad = getEaseRanking(difficulty);

      const rankingBase = Number(clamp(
        rankingWinrate[i] * weights.winrate +
          rankingPickrate[i] * weights.pickrate +
          rankingBanrate[i] * weights.banrate +
          rankingFacilidad * weights.facilidad,
        0,
        100,
      ).toFixed(2));

      const rankCount = Math.max(0, Math.min(
        toNumber(champ.rank_count),
        RANK_KEYS.length,
      ));

      const presenceRatio = RANK_KEYS.length > 0
        ? rankCount / RANK_KEYS.length
        : 0;

      const highRankRatio = MAX_RANK_WEIGHT > 0
        ? clamp(toNumber(champ.rank_weight_sum) / MAX_RANK_WEIGHT, 0, 1)
        : 0;

      const ranksPresent = Array.isArray(champ.ranks_present)
        ? champ.ranks_present.map(String)
        : [];

      const appearsInMaster = ranksPresent.includes("3");
      const appearsInGrandmaster = ranksPresent.includes("4");
      const appearsInHighElo = appearsInMaster || appearsInGrandmaster;

      let competitiveFactor = 1;

      if (applyEloPresencePenalty) {
        competitiveFactor =
          COMPETITIVE_BASE_FACTOR +
          presenceRatio * PRESENCE_FACTOR_WEIGHT +
          highRankRatio * HIGH_RANK_FACTOR_WEIGHT;

        if (!appearsInHighElo) {
          competitiveFactor *= 0.82;
        }

        if (rankCount === 1) {
          competitiveFactor *= 0.88;
        }
      }

      const rankingFinal = Number(clamp(
        rankingBase * competitiveFactor,
        0,
        100,
      ).toFixed(2));

      return {
        ...champ,
        difficultyL: difficulty,
        ranking_winrate: rankingWinrate[i],
        ranking_pickrate: rankingPickrate[i],
        ranking_banrate: rankingBanrate[i],
        ranking_facilidad: rankingFacilidad,
        ranking_base: rankingBase,
        presence_ratio: Number(presenceRatio.toFixed(4)),
        high_rank_ratio: Number(highRankRatio.toFixed(4)),
        competitive_factor: Number(competitiveFactor.toFixed(4)),
        appears_in_master: appearsInMaster,
        appears_in_grandmaster: appearsInGrandmaster,
        appears_in_high_elo: appearsInHighElo,
        ranking_final: rankingFinal,
        tier: assignTier(rankingFinal),
      };
    })
    .sort((a, b) => b.ranking_final - a.ranking_final)
    .map((champ, idx) => ({
      ...champ,
      position_in_lane: idx + 1,
    }));
}

function buildAveragedLaneData(dataRank: any, dataChamp: any, log: (message: string) => void) {
  const aggregatedByPosition: Record<string, Map<string, any>> = {};

  for (const posKey of Object.keys(POSITIONS)) {
    aggregatedByPosition[posKey] = new Map();
  }

  for (const rankKey of RANK_KEYS) {
    const rankData = dataRank?.data?.[rankKey] || {};
    const rankWeight = RANK_WEIGHTS[rankKey] || 1;

    log(`Procesando rango ${rankKey}...`);

    for (const posKey of Object.keys(POSITIONS)) {
      const championsInLane = rankData?.[posKey] || [];

      for (const campeon of championsInLane) {
        const heroId = campeon?.hero_id;

        if (heroId === null || heroId === undefined) {
          continue;
        }

        const heroIdString = String(heroId);

        if (!aggregatedByPosition[posKey].has(heroIdString)) {
          aggregatedByPosition[posKey].set(heroIdString, {
            hero_id: heroIdString,
            ranks_present: new Set<string>(),
            metrics: {
              win_rate_percent: [],
              appear_rate_percent: [],
              forbid_rate_percent: [],
            },
          });
        }

        const current = aggregatedByPosition[posKey].get(heroIdString);
        current.ranks_present.add(rankKey);

        for (const metric of METRIC_KEYS) {
          if (campeon?.[metric] !== null && campeon?.[metric] !== undefined) {
            current.metrics[metric].push({
              value: toNumber(campeon[metric]),
              weight: rankWeight,
            });
          }
        }
      }
    }
  }

  const laneData: Record<string, any[]> = {};

  for (const [posKey, lane] of Object.entries(POSITIONS)) {
    laneData[lane] = [];

    for (const [heroId, aggregatedChamp] of aggregatedByPosition[posKey].entries()) {
      const champMeta = getChampionMeta(dataChamp, heroId);

      const nameZh = champMeta?.name || heroId;
      const nameEs = DICT_CHAMP[nameZh] || nameZh;
      const ranksPresent = Array.from(aggregatedChamp.ranks_present || []);
      const rankCount = ranksPresent.length;
      const rankWeightSum = ranksPresent.reduce(
        (sum, rankKey) => sum + (RANK_WEIGHTS[String(rankKey)] || 0),
        0,
      );

      laneData[lane].push({
        name_es: nameEs,
        original_name: nameZh,
        hero_id: heroId,
        win_rate_percent: weightedAverage(aggregatedChamp.metrics.win_rate_percent),
        appear_rate_percent: weightedAverage(aggregatedChamp.metrics.appear_rate_percent),
        forbid_rate_percent: weightedAverage(aggregatedChamp.metrics.forbid_rate_percent),
        difficultyL: getSafeDifficulty(champMeta?.difficultyL),
        avatar: champMeta?.avatar || "",
        rank_count: rankCount,
        ranks_present: ranksPresent,
        rank_weight_sum: Number(rankWeightSum.toFixed(4)),
      });
    }

    log(`${lane}: ${laneData[lane].length} campeones consolidados`);
  }

  return laneData;
}

// Grupo de parche: 7.3, 7.3a y 7.3b promedian juntos como 7.3.
function getPatchGroup(patch: unknown) {
  const match = String(patch || "").trim().match(/^(\d+\.\d+)/);
  return match ? match[1] : null;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Fecha de los datos que publica Tencent (dtstatdate, formato YYYYMMDD).
function getLatestStatDate(dataRank: any) {
  let latest = "";

  for (const rankKey of RANK_KEYS) {
    const rankData = dataRank?.data?.[rankKey] || {};

    for (const posKey of Object.keys(POSITIONS)) {
      for (const campeon of rankData?.[posKey] || []) {
        const value = String(campeon?.dtstatdate || "");
        if (/^\d{8}$/.test(value) && value > latest) latest = value;
      }
    }
  }

  return latest ? `${latest.slice(0, 4)}-${latest.slice(4, 6)}-${latest.slice(6, 8)}` : null;
}

// La penalización por ausencia en elos arranca ELO_PENALTY_GRACE_DAYS después
// de activar en la app el primer parche de ese número (las letras no reinician).
function getEloPenaltyStartsOn(patches: any[], patchGroup: string) {
  const activations = patches
    .filter((patch) => getPatchGroup(patch.version) === patchGroup)
    .map((patch) => Date.parse(patch.release_at || patch.created_at))
    .filter(Number.isFinite);

  if (!activations.length) return null;

  const startsOn = new Date(Math.min(...activations));
  startsOn.setUTCDate(startsOn.getUTCDate() + ELO_PENALTY_GRACE_DAYS);
  return toIsoDate(startsOn);
}

async function fetchAllRows(buildQuery: (from: number, to: number) => any) {
  const PAGE_SIZE = 1000;
  const rows: any[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
}

async function rebuildPatchGroupAverages(
  supabaseAdmin: ReturnType<typeof createClient>,
  patchGroup: string,
  eloPenaltyStartsOn: string | null,
  log: (message: string) => void,
) {
  const executions = await fetchAllRows((from, to) =>
    supabaseAdmin
      .from("tierlist_executions")
      .select("snapshot_key, snapshot_date, patch, executed_at")
      .eq("patch_group", patchGroup)
      .in("status", ["success", "partial"])
      .order("executed_at", { ascending: false })
      .range(from, to)
  );

  // Un snapshot por día de datos: si el mismo día hay dos (ej. 7.3 y 7.3a), vale el último.
  const snapshotsByDate = new Map<string, any>();
  for (const execution of executions) {
    if (execution.snapshot_key && execution.snapshot_date && !snapshotsByDate.has(execution.snapshot_date)) {
      snapshotsByDate.set(execution.snapshot_date, execution);
    }
  }

  if (!snapshotsByDate.size) {
    log(`Promedio ${patchGroup}: sin snapshots exitosos, se omite.`);
    return 0;
  }

  const snapshots = [...snapshotsByDate.values()]
    .sort((a, b) => String(a.snapshot_date).localeCompare(String(b.snapshot_date)));
  const snapshotDateByKey = new Map<string, string>(
    snapshots.map((snapshot) => [snapshot.snapshot_key, snapshot.snapshot_date]),
  );
  const daysTotal = snapshots.length;

  const entries = await fetchAllRows((from, to) =>
    supabaseAdmin
      .from("tierlist_entries")
      .select(
        "id, champion_name, original_name, external_id, lane, winrate, pickrate, banrate, " +
          "difficulty, ranking_final, image_url, snapshot_key",
      )
      .in("snapshot_key", [...snapshotDateByKey.keys()])
      .order("id", { ascending: true })
      .range(from, to)
  );

  const byChampionLane = new Map<string, any>();

  for (const entry of entries) {
    const snapshotDate = snapshotDateByKey.get(entry.snapshot_key);
    const championKey = String(entry.external_id || "").trim() ||
      String(entry.champion_name || "").trim().toLowerCase();

    if (!snapshotDate || !championKey || !entry.lane) continue;

    const key = `${entry.lane}|${championKey}`;
    let current = byChampionLane.get(key);

    if (!current) {
      current = {
        key,
        championKey,
        lane: entry.lane,
        days: new Map<string, any>(),
        latest: entry,
        latestDate: snapshotDate,
      };
      byChampionLane.set(key, current);
    }

    if (current.days.has(snapshotDate)) continue;

    current.days.set(snapshotDate, {
      score: toNumber(entry.ranking_final),
      winrate: toNumber(entry.winrate),
      pickrate: toNumber(entry.pickrate),
      banrate: toNumber(entry.banrate),
    });

    if (snapshotDate >= current.latestDate) {
      current.latest = entry;
      current.latestDate = snapshotDate;
    }
  }

  // Peso de un día respecto de lastDate: los días recientes pesan más (media móvil exponencial).
  const dayWeight = (date: string, lastDate: string) => {
    const ageDays = (Date.parse(`${lastDate}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000;
    return Math.pow(0.5, Math.max(ageDays, 0) / AVERAGE_HALF_LIFE_DAYS);
  };

  // Promedio ponderado acumulado hasta lastDate (inclusive), ordenado por línea.
  const buildAverageRows = (lastDate: string) => {
    const rowsByLane: Record<string, any[]> = {};
    const groupWeight = snapshots
      .filter((snapshot) => snapshot.snapshot_date <= lastDate)
      .reduce((sum, snapshot) => sum + dayWeight(snapshot.snapshot_date, lastDate), 0);

    for (const champ of byChampionLane.values()) {
      const days = [...champ.days.entries()]
        .filter(([date]) => date <= lastDate)
        .map(([date, day]) => ({ ...day, weight: dayWeight(date, lastDate) }));

      if (!days.length) continue;

      const presentWeight = days.reduce((sum, day) => sum + day.weight, 0);
      const weightedMean = (key: string) =>
        days.reduce((sum, day) => sum + day[key] * day.weight, 0) / presentWeight;

      const rankingAverage = Number(weightedMean("score").toFixed(2));
      // Igual que con los elos: faltar días del parche resta score (más si son recientes).
      const dayPresenceFactor = DAY_PRESENCE_BASE_FACTOR +
        Math.min(presentWeight / groupWeight, 1) * DAY_PRESENCE_FACTOR_WEIGHT;
      const rankingFinal = Number(clamp(rankingAverage * dayPresenceFactor, 0, 100).toFixed(2));

      (rowsByLane[champ.lane] ||= []).push({
        champ,
        daysPresent: days.length,
        rankingAverage,
        dayPresenceFactor,
        rankingFinal,
        winrate: Number(weightedMean("winrate").toFixed(4)),
        pickrate: Number(weightedMean("pickrate").toFixed(4)),
        banrate: Number(weightedMean("banrate").toFixed(4)),
      });
    }

    return Object.values(rowsByLane).flatMap((laneRows) =>
      laneRows
        .sort((a, b) => b.rankingFinal - a.rankingFinal)
        .map((row, idx) => ({ ...row, position: idx + 1 }))
    );
  };

  // La variación se mide contra el promedio del día anterior dentro del mismo parche.
  const previousPositions = new Map<string, number>();
  if (daysTotal > 1) {
    for (const row of buildAverageRows(snapshots[daysTotal - 2].snapshot_date)) {
      previousPositions.set(row.champ.key, row.position);
    }
  }

  const now = new Date().toISOString();
  const rows = buildAverageRows(snapshots[daysTotal - 1].snapshot_date).map((row) => ({
    patch_group: patchGroup,
    champion_key: row.champ.championKey,
    champion_name: row.champ.latest.champion_name,
    original_name: row.champ.latest.original_name,
    external_id: row.champ.latest.external_id || null,
    lane: row.champ.lane,
    tier: assignTier(row.rankingFinal),
    winrate: row.winrate,
    pickrate: row.pickrate,
    banrate: row.banrate,
    difficulty: row.champ.latest.difficulty,
    ranking_average: row.rankingAverage,
    day_presence_factor: Number(row.dayPresenceFactor.toFixed(4)),
    ranking_final: row.rankingFinal,
    position_in_lane: row.position,
    previous_position_in_lane: previousPositions.get(row.champ.key) ?? null,
    days_present: row.daysPresent,
    days_total: daysTotal,
    image_url: row.champ.latest.image_url || "",
    updated_at: now,
  }));

  const { error: groupError } = await supabaseAdmin
    .from("tierlist_patch_groups")
    .upsert({
      patch_group: patchGroup,
      latest_patch: snapshots[snapshots.length - 1].patch,
      snapshots_count: daysTotal,
      first_snapshot_date: snapshots[0].snapshot_date,
      last_snapshot_date: snapshots[snapshots.length - 1].snapshot_date,
      elo_penalty_starts_on: eloPenaltyStartsOn,
      updated_at: now,
    }, { onConflict: "patch_group" });

  if (groupError) throw groupError;

  const BULK_BATCH = 100;

  for (let i = 0; i < rows.length; i += BULK_BATCH) {
    const { error } = await supabaseAdmin
      .from("tierlist_patch_averages")
      .upsert(rows.slice(i, i + BULK_BATCH), { onConflict: "patch_group,lane,champion_key" });

    if (error) throw error;
  }

  const { error: staleError } = await supabaseAdmin
    .from("tierlist_patch_averages")
    .delete()
    .eq("patch_group", patchGroup)
    .lt("updated_at", now);

  if (staleError) throw staleError;

  log(`Promedio ${patchGroup}: ${rows.length} entradas sobre ${daysTotal} snapshot(s).`);
  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let supabaseAdmin: ReturnType<typeof createClient> | null = null;
  let executionId: string | null = null;
  let snapshotSaved = false;
  let executionPatch = "unknown";
  let executionPatchGroup: string | null = null;
  let executionSnapshotDate = new Date().toISOString().slice(0, 10);
  let executionSnapshotKey = `unknown::${executionSnapshotDate}`;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("TIERLIST_CRON_SECRET");

    if (!supabaseUrl || !supabaseServiceRoleKey || !cronSecret) {
      return jsonResponse({ error: "Missing Supabase environment variables" }, 500);
    }

    if (req.headers.get("x-cron-secret") !== cronSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log(msg);
    };

    const body = await req.json().catch(() => ({}));
    // force: recalcula aunque los datos de ese día ya estén procesados.
    // rebuild_averages: "all" recalcula los promedios de todos los grupos de parche.
    const force = body?.force === true;
    const rebuildAllAverages = body?.rebuild_averages === "all";

    const [configResult, stateResult, patchesResult] = await Promise.all([
      supabaseAdmin
        .from("tierlist_configs")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("game_state")
        .select("active_patch_id")
        .eq("id", 1)
        .maybeSingle(),
      supabaseAdmin
        .from("game_patches")
        .select("id, version, status, release_at, created_at"),
    ]);

    if (configResult.error) throw configResult.error;
    if (stateResult.error) throw stateResult.error;
    if (patchesResult.error) throw patchesResult.error;

    const gamePatches = patchesResult.data || [];
    const activePatch = gamePatches.find(
      (gamePatch) => String(gamePatch.id) === String(stateResult.data?.active_patch_id),
    );

    if (!activePatch) {
      throw new Error("No hay un parche activo configurado en la app (game_state).");
    }

    const patch = String(activePatch.version).trim();
    const patchGroup = getPatchGroup(patch);
    executionPatch = patch;
    executionPatchGroup = patchGroup;

    if (!patchGroup) {
      throw new Error(`El parche activo "${patch}" no tiene formato número.número.`);
    }

    const publishedPatches = gamePatches.filter(
      (gamePatch) => gamePatch.status === "active" || gamePatch.status === "archived",
    );
    const eloPenaltyStartsOn = getEloPenaltyStartsOn(publishedPatches, patchGroup);
    const applyEloPresencePenalty = eloPenaltyStartsOn !== null &&
      toIsoDate(new Date()) >= eloPenaltyStartsOn;
    const weights = normalizeWeights(configResult.data || {});

    log(`Parche activo: ${patch} (grupo ${patchGroup})`);
    log("Iniciando extracción de datos desde API de Tencent...");
    log(`Rangos a promediar: ${RANK_KEYS.join(", ")}`);
    log(`Pesos normalizados: ${JSON.stringify(weights)}`);
    log(
      `Penalización por ausencia en elos: ${applyEloPresencePenalty ? "activada" : "desactivada"}` +
        (eloPenaltyStartsOn ? ` (se activa el ${eloPenaltyStartsOn})` : ""),
    );

    const [respRank, respChamp] = await Promise.all([
      fetch(RANK_URL, { headers: { "User-Agent": "Mozilla/5.0" } }),
      fetch(CHAMP_URL, { headers: { "User-Agent": "Mozilla/5.0" } }),
    ]);

    if (!respRank.ok) {
      throw new Error(`Error al obtener datos de ranking: ${respRank.status}`);
    }

    if (!respChamp.ok) {
      throw new Error(`Error al obtener datos de campeones: ${respChamp.status}`);
    }

    const [dataRank, dataChamp] = await Promise.all([
      respRank.json(),
      respChamp.json(),
    ]);

    const snapshotDate = getLatestStatDate(dataRank) || toIsoDate(new Date());
    const snapshotKey = `${patch.toLocaleLowerCase()}::${snapshotDate}`;
    executionSnapshotDate = snapshotDate;
    executionSnapshotKey = snapshotKey;

    log(`Datos obtenidos. Fecha de los datos de Tencent: ${snapshotDate}`);

    const { data: processedSnapshots, error: processedError } = await supabaseAdmin
      .from("tierlist_executions")
      .select("id")
      .eq("snapshot_date", snapshotDate)
      .in("status", ["success", "partial"])
      .limit(1);

    if (processedError) throw processedError;

    const alreadyProcessed = !force && (processedSnapshots?.length || 0) > 0;

    if (alreadyProcessed && !rebuildAllAverages) {
      log(`Los datos del ${snapshotDate} ya estaban procesados; no se genera un snapshot nuevo.`);
      return jsonResponse({
        status: "skipped",
        patch,
        patch_group: patchGroup,
        snapshot_date: snapshotDate,
        logs: logs.join("\n"),
      });
    }

    let championsProcessed = 0;

    if (!alreadyProcessed) {
      log(`Snapshot: parche ${patch}, fecha ${snapshotDate}. Promediando rangos por campeón y línea...`);

      const laneData = buildAveragedLaneData(dataRank, dataChamp, log);
      const allEntries: Array<{ lane: string; champ: any }> = [];
      const unmapped: string[] = [];

      for (const [lane, champions] of Object.entries(laneData)) {
        const processed = processLane(champions, weights, applyEloPresencePenalty);

        for (const champ of processed) {
          if (champ.name_es === champ.original_name && champ.original_name) {
            unmapped.push(`${champ.original_name} (${lane})`);
          }

          allEntries.push({ lane, champ });
        }

        log(
          `${lane}: procesado. ` +
            `Tier S+: ${processed.filter((c) => c.tier === "S+").length}, ` +
            `S: ${processed.filter((c) => c.tier === "S").length}`,
        );
      }

      const executionPayload = {
        patch,
        patch_group: patchGroup,
        snapshot_date: snapshotDate,
        snapshot_key: snapshotKey,
        executed_at: new Date().toISOString(),
        status: "running",
        champions_processed: allEntries.length,
        lanes_processed: Object.keys(laneData).length,
        data_source: "mlol.qt.qq.com",
        admin_user: body?.trigger === "cron" ? "cron" : "manual",
        weights_used: {
          ...weights,
          difficulty_default: 2,
          averaged_ranks: RANK_KEYS,
          rank_weights: RANK_WEIGHTS,
          competitive_base_factor: COMPETITIVE_BASE_FACTOR,
          presence_factor_weight: PRESENCE_FACTOR_WEIGHT,
          high_rank_factor_weight: HIGH_RANK_FACTOR_WEIGHT,
          apply_elo_presence_penalty: applyEloPresencePenalty,
          elo_penalty_starts_on: eloPenaltyStartsOn,
        },
        unmapped_champions: unmapped,
        logs: logs.join("\n"),
        error_message: null,
      };

      const { data: previousExecution, error: previousExecutionError } = await supabaseAdmin
        .from("tierlist_executions")
        .select("id")
        .eq("snapshot_key", snapshotKey)
        .order("executed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousExecutionError) throw previousExecutionError;

      if (previousExecution?.id) {
        const { data: updatedExecution, error: updateExecutionError } = await supabaseAdmin
          .from("tierlist_executions")
          .update(executionPayload)
          .eq("id", previousExecution.id)
          .select("id")
          .single();

        if (updateExecutionError) throw updateExecutionError;
        executionId = String(updatedExecution.id);
      } else {
        const { data: createdExecution, error: createExecutionError } = await supabaseAdmin
          .from("tierlist_executions")
          .insert(executionPayload)
          .select("id")
          .single();

        if (createExecutionError) throw createExecutionError;
        executionId = String(createdExecution.id);
      }

      log("Eliminando entradas anteriores del mismo snapshot...");

      const { error: deleteError } = await supabaseAdmin
        .from("tierlist_entries")
        .delete()
        .eq("snapshot_key", snapshotKey);

      if (deleteError) throw deleteError;

      const now = new Date().toISOString();
      const records = allEntries.map(({ lane, champ }) => ({
        champion_name: champ.name_es,
        original_name: champ.original_name,
        external_id: String(champ.hero_id || ""),
        lane,
        tier: champ.tier,
        patch,
        patch_group: patchGroup,
        snapshot_date: snapshotDate,
        snapshot_key: snapshotKey,
        winrate: champ.win_rate_percent,
        pickrate: champ.appear_rate_percent,
        banrate: champ.forbid_rate_percent,
        difficulty: champ.difficultyL,
        ranking_winrate: champ.ranking_winrate,
        ranking_pickrate: champ.ranking_pickrate,
        ranking_banrate: champ.ranking_banrate,
        ranking_facilidad: champ.ranking_facilidad,
        ranking_final: champ.ranking_final,
        position_in_lane: champ.position_in_lane,
        image_url: champ.avatar || "",
        data_source: "mlol.qt.qq.com",
        updated_at: now,
      }));

      log(`Guardando ${records.length} entradas nuevas...`);

      const BULK_BATCH = 100;

      for (let i = 0; i < records.length; i += BULK_BATCH) {
        const { error: insertError } = await supabaseAdmin
          .from("tierlist_entries")
          .insert(records.slice(i, i + BULK_BATCH));

        if (insertError) throw insertError;
      }

      log(`Guardadas ${records.length} entradas correctamente.`);
      championsProcessed = records.length;

      const { error: executionError } = await supabaseAdmin
        .from("tierlist_executions")
        .update({
          ...executionPayload,
          executed_at: new Date().toISOString(),
          status: "success",
          champions_processed: records.length,
          logs: logs.join("\n"),
        })
        .eq("id", executionId);

      if (executionError) throw executionError;
      snapshotSaved = true;
    }

    // Promedio acumulado del grupo actual, más los grupos que todavía no tienen
    // promedio (primer despliegue) o todos si se pidió rebuild_averages: "all".
    const [executionGroups, existingGroups] = await Promise.all([
      fetchAllRows((from, to) =>
        supabaseAdmin!
          .from("tierlist_executions")
          .select("patch_group")
          .in("status", ["success", "partial"])
          .not("patch_group", "is", null)
          .range(from, to)
      ),
      fetchAllRows((from, to) =>
        supabaseAdmin!
          .from("tierlist_patch_groups")
          .select("patch_group")
          .range(from, to)
      ),
    ]);

    const existingGroupSet = new Set(existingGroups.map((row) => row.patch_group));
    const groupsToRebuild = new Set<string>([patchGroup]);

    for (const { patch_group: group } of executionGroups) {
      if (rebuildAllAverages || !existingGroupSet.has(group)) groupsToRebuild.add(group);
    }

    for (const group of groupsToRebuild) {
      await rebuildPatchGroupAverages(
        supabaseAdmin,
        group,
        getEloPenaltyStartsOn(publishedPatches, group),
        log,
      );
    }

    if (executionId) {
      await supabaseAdmin
        .from("tierlist_executions")
        .update({ logs: logs.join("\n") })
        .eq("id", executionId);
    }

    return jsonResponse({
      status: "success",
      champions_processed: championsProcessed,
      patch,
      patch_group: patchGroup,
      snapshot_date: snapshotDate,
      snapshot_key: snapshotKey,
      averages_rebuilt: [...groupsToRebuild],
      logs: logs.join("\n"),
    });
  } catch (error) {
    console.error("Error en update-tierlist:", error);

    const message = error instanceof Error ? error.message : "Unexpected error";
    const stack = error instanceof Error ? error.stack || error.message : message;

    try {
      if (supabaseAdmin && executionId && snapshotSaved) {
        // El snapshot diario quedó bien; solo falló el promedio del parche.
        await supabaseAdmin.from("tierlist_executions").update({
          error_message: `Snapshot guardado, pero falló el promedio del parche: ${message}`,
        }).eq("id", executionId);
      } else if (supabaseAdmin && executionId) {
        await supabaseAdmin.from("tierlist_executions").update({
          patch: executionPatch,
          patch_group: executionPatchGroup,
          snapshot_date: executionSnapshotDate,
          snapshot_key: executionSnapshotKey,
          executed_at: new Date().toISOString(),
          status: "failed",
          error_message: message,
          data_source: "mlol.qt.qq.com",
          logs: stack,
        }).eq("id", executionId);
      } else if (supabaseAdmin) {
        await supabaseAdmin.from("tierlist_executions").insert({
          patch: executionPatch,
          patch_group: executionPatchGroup,
          snapshot_date: executionSnapshotDate,
          snapshot_key: executionSnapshotKey,
          executed_at: new Date().toISOString(),
          status: "failed",
          error_message: message,
          data_source: "mlol.qt.qq.com",
          logs: stack,
        });
      }
    } catch (_) {
      // Ignore logging failures.
    }

    return jsonResponse({
      status: "failed",
      error_message: message,
    }, 500);
  }
});
