import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Rune } from '@/api/entitiesSupabase';

const BRANCH_COLORS = {
  'Clave': 'border-yellow-400/70 shadow-yellow-400/40',
  'Precisión': 'border-blue-400/70 shadow-blue-400/40',
  'Dominación': 'border-red-400/70 shadow-red-400/40',
  'Valor': 'border-green-400/70 shadow-green-400/40',
  'Brujería': 'border-purple-400/70 shadow-purple-400/40',
};

function RuneIcon({ rune, selected, onClick }) {
  const branchGlow = BRANCH_COLORS[rune.branch] || 'border-primary/70 shadow-primary/40';

  return (
    <button
      onClick={() => onClick(rune)}
      title={`${rune.name}${rune.description ? '\n' + rune.description : ''}`}
      className={`relative rounded-full border-2 transition-all flex-shrink-0 overflow-hidden w-9 h-9 cursor-pointer
        ${selected
          ? `${branchGlow} shadow-[0_0_8px_1px] scale-110`
          : 'border-border/40 opacity-50 hover:opacity-80 hover:border-border'
        }`}
    >
      {rune.image_url
        ? <img src={rune.image_url} alt={rune.name} className="w-full h-full object-cover rounded-full" />
        : (
          <div className={`w-full h-full flex items-center justify-center text-xs font-bold rounded-full
            ${selected ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
            {rune.name?.[0]}
          </div>
        )
      }
    </button>
  );
}

const PRIMARY_BRANCHES = ['Dominación', 'Precisión', 'Valor', 'Brujería'];

export default function RunePicker({ selectedRunes, onToggleRune, initialRuneNames = [], onRunesInitialized, initialPrimaryBranch, initialSecondaryBranch }) {
  const [primaryBranch, setPrimaryBranch] = useState(initialPrimaryBranch || 'Dominación');
  const [secondaryBranch, setSecondaryBranch] = useState(initialSecondaryBranch || 'Precisión');
  const [initialized, setInitialized] = useState(false);

  const { data: runes = [], isLoading } = useQuery({
    queryKey: ['runes'],
    queryFn: () => Rune.list('branch'),
  });

  // Restore runes from saved names once rune data is loaded
  useEffect(() => {
    if (initialized || isLoading || runes.length === 0 || initialRuneNames.length === 0) return;
    
    const resolved = initialRuneNames
      .map(name => runes.find(r => r.name === name))
      .filter(Boolean);

    if (resolved.length > 0) {
      // Detect branches from resolved runes (excluding Clave)
      const nonClaveRunes = resolved.filter(r => r.branch !== 'Clave');
      const branches = [...new Set(nonClaveRunes.map(r => r.branch))];
      const detectedPrimary = branches[0] || 'Dominación';
      const detectedSecondary = branches[1] || PRIMARY_BRANCHES.find(b => b !== detectedPrimary);
      setPrimaryBranch(detectedPrimary);
      setSecondaryBranch(detectedSecondary);
      onRunesInitialized?.(resolved);
    }
    setInitialized(true);
  }, [runes, isLoading]);

  if (isLoading) {
    return (
      <div className="rd-card p-4">
        <div className="flex items-center gap-2 mb-3"><span className="w-5 h-px bg-primary/50" /><h3 className="rd-card-title">Runas</h3></div>
        <div className="animate-pulse h-24 bg-secondary/20 rounded-lg" />
      </div>
    );
  }

  const isSelected = (rune) => selectedRunes.some(r => r.id === rune.id);
  const selectedPrimaryRunes = selectedRunes.filter(r => r.branch === primaryBranch);
  const selectedSecondaryRunes = selectedRunes.filter(r => r.branch === secondaryBranch);

  const handleToggleRune = (rune, isSecondary) => {
    if (isSelected(rune)) {
      onToggleRune(rune);
      return;
    }

    // Runas Clave: solo 1 permitida, desseleccionar la anterior
    if (rune.branch === 'Clave') {
      const prevClave = selectedRunes.find(r => r.branch === 'Clave');
      if (prevClave) onToggleRune(prevClave);
      onToggleRune(rune);
      return;
    }

    if (isSecondary) {
      // Rama secundaria: reemplazar la anterior si existe
      if (selectedSecondaryRunes.length > 0) {
        onToggleRune(selectedSecondaryRunes[0]);
      }
      onToggleRune(rune);
    } else {
      // Rama principal: reemplazar si hay otra del mismo grupo
      const sameGroupRune = selectedPrimaryRunes.find(r => r.group === rune.group);
      if (sameGroupRune) {
        onToggleRune(sameGroupRune);
      } else if (selectedPrimaryRunes.length >= 3) {
        // Si ya hay 3, reemplazar la primera
        onToggleRune(selectedPrimaryRunes[0]);
      }
      onToggleRune(rune);
    }
  };

  // Separar runas Clave de las demás
  const claveRunes = runes.filter(r => r.branch === 'Clave');
  const otherRunes = runes.filter(r => r.branch !== 'Clave');

  // Obtener runas por rama ordenadas por grupo
  const getRunesByBranch = (branch) => {
    return otherRunes
      .filter(r => r.branch === branch)
      .sort((a, b) => (a.group || 0) - (b.group || 0));
  };

  const primaryRunes = getRunesByBranch(primaryBranch);
  const secondaryRunes = getRunesByBranch(secondaryBranch);

  // Agrupar runas por grupo
  const groupRunes = (runesList) => {
    const grouped = {};
    for (const rune of runesList) {
      const group = rune.group || 1;
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(rune);
    }
    return grouped;
  };

  return (
    <div className="rd-card p-4">
      <div className="flex items-center gap-2 mb-4"><span className="w-5 h-px bg-primary/50" /><h3 className="rd-card-title">Runas</h3></div>

      {/* Runas Clave */}
      {claveRunes.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Clave</p>
          <div className="flex flex-wrap gap-2">
            {claveRunes.map(rune => (
              <RuneIcon key={rune.id} rune={rune} selected={isSelected(rune)} onClick={() => handleToggleRune(rune, false)} />
            ))}
          </div>
        </div>
      )}

      {/* Divisor */}
      {claveRunes.length > 0 && <div className="h-px bg-border/50 mb-6" />}

      {/* Rama Principal y Secundaria */}
      <div className="grid grid-cols-2 gap-6">
        {/* Rama Principal */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Rama Principal</label>
          <select
            value={primaryBranch}
            onChange={e => {
              const newPrimary = e.target.value;
              let updatedRunes = selectedRunes;

              // Si el nuevo valor es igual a la rama secundaria, hacer swap
              if (newPrimary === secondaryBranch) {
                const newSecondary = PRIMARY_BRANCHES.find(b => b !== newPrimary);
                // Desseleccionar todas las runas de ambas ramas que van a cambiar
                updatedRunes = updatedRunes.filter(r => r.branch !== primaryBranch && r.branch !== newPrimary);
                // Aplicar cambios
                updatedRunes.forEach(r => {
                  if (!selectedRunes.includes(r)) onToggleRune(r);
                });
                selectedRunes.forEach(r => {
                  if (!updatedRunes.includes(r)) onToggleRune(r);
                });
                setSecondaryBranch(newSecondary);
              } else {
                // Desseleccionar todas las runas de la rama principal anterior y nueva
                updatedRunes = updatedRunes.filter(r => r.branch !== primaryBranch && r.branch !== newPrimary);
                updatedRunes.forEach(r => {
                  if (!selectedRunes.includes(r)) onToggleRune(r);
                });
                selectedRunes.forEach(r => {
                  if (!updatedRunes.includes(r)) onToggleRune(r);
                });
              }
              setPrimaryBranch(newPrimary);
            }}
            className="w-full bg-secondary/70 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground mb-3 outline-none focus:border-primary/40 transition-all"
          >
            {PRIMARY_BRANCHES.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <div className="space-y-2">
            {Object.entries(groupRunes(primaryRunes)).map(([group, runesInGroup]) => (
              <div key={group}>
                <p className="text-xs text-muted-foreground mb-1">Grupo {group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {runesInGroup.map(rune => (
                    <RuneIcon key={rune.id} rune={rune} selected={isSelected(rune)} onClick={() => handleToggleRune(rune, false)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rama Secundaria */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Rama Secundaria</label>
          <select
            value={secondaryBranch}
            onChange={e => {
              const newSecondary = e.target.value;
              let updatedRunes = selectedRunes;

              // Si el nuevo valor es igual a la rama principal, hacer swap
              if (newSecondary === primaryBranch) {
                const newPrimary = PRIMARY_BRANCHES.find(b => b !== newSecondary);
                // Desseleccionar todas las runas de ambas ramas que van a cambiar
                updatedRunes = updatedRunes.filter(r => r.branch !== primaryBranch && r.branch !== newSecondary);
                // Aplicar cambios
                updatedRunes.forEach(r => {
                  if (!selectedRunes.includes(r)) onToggleRune(r);
                });
                selectedRunes.forEach(r => {
                  if (!updatedRunes.includes(r)) onToggleRune(r);
                });
                setPrimaryBranch(newPrimary);
              } else {
                // Desseleccionar todas las runas de la rama secundaria anterior y nueva
                updatedRunes = updatedRunes.filter(r => r.branch !== secondaryBranch && r.branch !== newSecondary);
                updatedRunes.forEach(r => {
                  if (!selectedRunes.includes(r)) onToggleRune(r);
                });
                selectedRunes.forEach(r => {
                  if (!updatedRunes.includes(r)) onToggleRune(r);
                });
              }
              setSecondaryBranch(newSecondary);
            }}
            className="w-full bg-secondary/70 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground mb-3 outline-none focus:border-primary/40 transition-all"
          >
            {PRIMARY_BRANCHES.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <div className="space-y-2">
            {Object.entries(groupRunes(secondaryRunes)).map(([group, runesInGroup]) => (
              <div key={group}>
                <p className="text-xs text-muted-foreground mb-1">Grupo {group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {runesInGroup.map(rune => (
                    <RuneIcon key={rune.id} rune={rune} selected={isSelected(rune)} onClick={() => handleToggleRune(rune, true)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          </div>
          </div>

      {/* Runas seleccionadas */}
      {selectedRunes.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-1.5">
          {selectedRunes.map(r => (
            <span key={r.id} className="flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded text-xs">
              {r.image_url && <img src={r.image_url} alt={r.name} className="w-3.5 h-3.5 rounded-full" />}
              {r.name}
              <button onClick={() => onToggleRune(r)} className="ml-0.5 hover:text-red-400">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
