import { Edit, Trash2, Clock3 } from 'lucide-react';
import LaneBadge from '@/components/ui/LaneBadge';

const isMovement = (item) =>
  item && Array.isArray(item.type) && item.type.includes('Movimiento');
const isEnchantment = (item) =>
  item && item.category === 'Mejorado' && Array.isArray(item.type) && item.type.includes('Encantamiento');

function buildMatchSlots(itemNames, items) {
  const normalItems = [];
  let movementItem = null;
  let enchantItem = null;

  for (const name of itemNames) {
    const item = items.find(i => i.name === name);
    if (!item) {
      normalItems.push(name);
      continue;
    }
    if (isEnchantment(item)) enchantItem = item;
    else if (isMovement(item)) movementItem = item;
    else normalItems.push(name);
  }

  // Build a 6-slot array: 5 normal + 1 movement/enchant at the end
  const slots = [...normalItems.slice(0, 5)];
  while (slots.length < 5) slots.push(null);

  return { slots, movementItem, enchantItem };
}

function ChampionIcon({
  name,
  champions,
  size = 'w-10 h-10',
  highlight = false,
}) {
  const champ = champions.find(c => c.name === name);

  return (
    <div
      className={`
        ${size}
        rounded-xl
        overflow-hidden
        bg-muted
        flex items-center justify-center
        shrink-0
        transition-all
        border
        ${highlight
          ? 'border-primary shadow-[0_0_18px_rgba(212,175,55,.22)] scale-[1.04]'
          : 'border-border/40'}
      `}
      title={name}
    >
      {champ?.image_url ? (
        <img
          src={champ.image_url}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-xs font-bold text-primary">
          {name?.[0]}
        </span>
      )}
    </div>
  );
}

function ItemIcon({ name, items }) {
  const item = items.find(i => i.name === name);

  return (
    <div
      className="
        w-10 h-10
        rounded-xl
        overflow-hidden
        bg-secondary/70
        border border-border/40
        flex items-center justify-center
        shrink-0
        transition-all
        hover:border-primary/40
        hover:scale-[1.03]
      "
      title={name}
    >
      {item?.image_url ? (
        <img
          src={item.image_url}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[9px] font-bold text-primary text-center px-0.5 leading-tight">
          {name?.slice(0, 3)}
        </span>
      )}
    </div>
  );
}

function EmptyIconSlot() {
  return (
    <div className="w-10 h-10 rounded-xl bg-secondary/30 border border-border/20" />
  );
}

function placeChampionInRole(names, championName, role, roleOrder) {
  const normalizedNames = names.filter(Boolean);
  const roleIndex = roleOrder.indexOf(role);

  if (!championName || roleIndex < 0 || !normalizedNames.includes(championName)) {
    return normalizedNames;
  }

  const withoutChampion = normalizedNames.filter(name => name !== championName);
  withoutChampion.splice(Math.min(roleIndex, withoutChampion.length), 0, championName);

  return withoutChampion;
}

function InfoStat({ label, value, valueClass = 'text-foreground' }) {
  if (!value) return <div />;

  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
        {label}
      </span>

      <span className={`text-sm font-bold whitespace-nowrap overflow-visible md:truncate ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

export default function MatchCard({
  match,
  champions,
  items,
  onEdit,
  onDelete,
}) {
  const isWin = match.result === 'win';

  const ownName = match.own_champion_name;

  const myChamp = champions.find(
    c => c.name === ownName
  );

  const ROLE_ORDER = ['top', 'jungler', 'mid', 'adc', 'support'];

  const rawAllies = match.ally_champions || [];
  const ownLane = match.lane;

  const orderedAllies = placeChampionInRole(
    rawAllies.includes(ownName) ? rawAllies : [...rawAllies, ownName],
    ownName,
    ownLane,
    ROLE_ORDER
  );

  const enemyNames = placeChampionInRole(
    match.enemy_champions || [],
    match.enemy_champion_name,
    ownLane,
    ROLE_ORDER
  );
  const itemNames = match.items_used || [];
  const tags = Array.isArray(match.tags) ? match.tags.filter(Boolean) : [];

  const formatDate = (d) => {
    if (!d) return null;

    const parts = d.split('T')[0].split('-');

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const formatGold = (g) =>
    g ? `${(g / 1000).toFixed(1)}k` : null;

  const { slots, movementItem, enchantItem } = buildMatchSlots(itemNames, items);

  return (
    <div
      className={`
        relative overflow-hidden transition-all duration-300
        hover:border-primary/30 hover:shadow-[0_0_30px_rgba(212,175,55,.06)]
        ${isWin ? 'before:bg-green-500' : 'before:bg-red-500'}
        before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px]
      `}
    >
      {/* glow */}
      <div
        className={`
          absolute inset-0 opacity-[0.04] pointer-events-none
          ${isWin
            ? 'bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,.45),transparent_45%)]'
            : 'bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,.4),transparent_45%)]'}
        `}
      />

      <div
        className="
          relative flex flex-col px-4 py-4 w-full gap-4
          md:grid md:items-center md:px-5 md:py-4
          md:grid-cols-[minmax(360px,1fr)_1px_175px_1px_270px_42px]
          md:gap-4
        "
      >
        {/* ================= LEFT ================= */}
        <div className="flex items-center gap-4 min-w-0 w-full md:gap-5">

          {/* RESULT */}
          <div className={`w-14 shrink-0 text-center ${isWin ? 'text-green-400' : 'text-red-400'}`}>
            <p className="font-rajdhani font-bold text-4xl leading-none tracking-[-0.08em]">
              {isWin ? 'V' : 'D'}
            </p>

            <p className="text-[9px] uppercase tracking-[0.14em] font-bold mt-1">
              {isWin ? 'VICTORIA' : 'DERROTA'}
            </p>

            {match.duration_minutes && (
              <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-muted-foreground">
                <Clock3 size={10} />
                <span>{match.duration_minutes}m</span>
              </div>
            )}
          </div>

          {/* CHAMP */}
          <div
            className="
              relative w-14 h-14 rounded-2xl overflow-hidden
              border border-primary/20 shadow-[0_0_18px_rgba(212,175,55,.12)]
              shrink-0
            "
          >
            {myChamp?.image_url ? (
              <img
                src={myChamp.image_url}
                alt={ownName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-lg text-primary">
                {ownName?.[0]}
              </div>
            )}
          </div>

          {/* INFO */}
          <div className="flex flex-col justify-center gap-2 min-w-0 flex-1">

            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-rajdhani font-bold text-xl tracking-[-0.05em] text-foreground truncate max-w-[130px]">
                {ownName}
              </h2>

              {match.lane && (
                <LaneBadge lane={match.lane} />
              )}

              {match.side && (
                <span
                  className={`
                    text-[10px] uppercase tracking-[0.12em]
                    px-2 py-1 rounded-md border font-semibold
                    ${match.side === 'blue'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'}
                  `}
                >
                  {match.side === 'blue' ? 'Blue' : 'Red'}
                </span>
              )}

              {tags.map(tag => (
                <span
                  key={tag}
                  className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-md border font-semibold bg-primary/10 text-primary border-primary/20"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="inline-grid grid-cols-[auto_auto] gap-x-2 gap-y-2 self-start md:grid md:grid-cols-[auto_auto_auto_auto] md:gap-x-3 md:gap-y-2 md:self-auto">
              <InfoStat
                label="KDA"
                value={`${match.kills ?? 0}/${match.deaths ?? 0}/${match.assists ?? 0}`}
              />

              <InfoStat
                label="ORO"
                value={formatGold(match.gold)}
              />

              <InfoStat
                label="PATCH"
                value={match.patch}
              />

              <InfoStat
                label="FECHA"
                value={formatDate(match.date)}
              />
            </div>
          </div>
        </div>

        {/* divider */}
        <div className="hidden md:block w-px h-full bg-border/50" />

        {/* ================= BUILD ================= */}
        <div className="flex flex-col justify-center gap-[14px] w-full rounded-2xl bg-secondary/20 border border-border/30 p-3 md:w-auto md:rounded-none md:bg-transparent md:border-0 md:p-0">
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-primary/80 font-bold mb-2">
              BUILD
            </p>

            <div className="grid grid-cols-3 gap-2 w-full">
              {slots.slice(0, 3).map((name, i) =>
                name ? (
                  <ItemIcon key={i} name={name} items={items} />
                ) : (
                  <EmptyIconSlot key={i} />
                )
              )}
            </div>
          </div>

          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] font-bold mb-2 invisible">
              BUILD
            </p>

            <div className="grid grid-cols-3 gap-2 w-full">
              {slots.slice(3, 5).map((name, i) =>
                name ? (
                  <ItemIcon key={i} name={name} items={items} />
                ) : (
                  <EmptyIconSlot key={i} />
                )
              )}

              {/* 6th slot: movement/enchantment */}
              {(() => {
                if (enchantItem && movementItem) {
                  return (
                    <div className="relative w-10 h-10 rounded-xl border border-purple-400/50 bg-purple-400/10 flex items-center justify-center shrink-0 overflow-visible" title={enchantItem.name}>
                      {enchantItem.image_url
                        ? <img src={enchantItem.image_url} alt={enchantItem.name} className="w-full h-full object-cover rounded-xl" />
                        : <span className="text-[9px] font-bold text-primary text-center px-0.5 leading-tight">{enchantItem.name?.slice(0, 3)}</span>}
                      <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded border border-blue-400/50 bg-card overflow-hidden shadow-md z-10" title={movementItem.name}>
                        {movementItem.image_url
                          ? <img src={movementItem.image_url} alt={movementItem.name} className="w-full h-full object-contain" />
                          : <span className="text-[7px] font-bold text-blue-300">{movementItem.name?.[0]}</span>}
                      </div>
                    </div>
                  );
                }
                if (enchantItem) return <ItemIcon name={enchantItem.name} items={items} />;
                if (movementItem) return <ItemIcon name={movementItem.name} items={items} />;
                return <EmptyIconSlot />;
              })()}
            </div>
          </div>
        </div>

        {/* divider */}
        <div className="w-px h-full bg-border/50" />

        {/* ================= TEAMS ================= */}
        <div className="flex flex-col justify-center gap-[14px] w-full rounded-2xl bg-secondary/20 border border-border/30 p-3 md:w-auto md:rounded-none md:bg-transparent md:border-0 md:p-0">

          {/* allies */}
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-blue-400 font-bold mb-2">
              TU EQUIPO
            </p>

            <div className="grid grid-cols-5 gap-2 w-full">
              {Array.from({ length: 5 }).map((_, i) => {
                const name = orderedAllies[i];

                return name ? (
                  <ChampionIcon
                    key={i}
                    name={name}
                    champions={champions}
                    highlight={name === ownName}
                  />
                ) : (
                  <EmptyIconSlot key={i} />
                );
              })}
            </div>
          </div>

          {/* enemies */}
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-red-400 font-bold mb-2">
              ENEMIGOS
            </p>

            <div className="grid grid-cols-5 gap-2 w-full">
              {Array.from({ length: 5 }).map((_, i) => {
                const name = enemyNames[i];

                return name ? (
                  <ChampionIcon
                    key={i}
                    name={name}
                    champions={champions}
                  />
                ) : (
                  <EmptyIconSlot key={i} />
                );
              })}
            </div>
          </div>
        </div>

        {/* ================= ACTIONS ================= */}
        <div className="flex flex-row md:flex-col gap-2 justify-end md:justify-self-end">
          <button
            onClick={() => onEdit(match)}
            className="
              w-9 h-9 rounded-xl bg-secondary/70 border border-border/40
              flex items-center justify-center text-muted-foreground
              hover:text-foreground hover:border-primary/30
              hover:bg-primary/5 transition-all
            "
          >
            <Edit size={15} />
          </button>

          <button
            onClick={() => onDelete(match.id)}
            className="
              w-9 h-9 rounded-xl bg-secondary/70 border border-border/40
              flex items-center justify-center text-muted-foreground
              hover:text-red-400 hover:border-red-500/30
              hover:bg-red-500/5 transition-all
            "
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
