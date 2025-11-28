import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell 
} from 'recharts';
import { 
  Activity, Search, Menu, Zap, ChevronDown, ChevronRight, Settings, Calendar 
} from 'lucide-react';

const THEME = {
  bg: "bg-[#09090b]",        
  card: "bg-[#18181b]",      
  text: "text-zinc-100",     
  subtext: "text-zinc-500",  
};

const getTeamLogo = (teamId) => `https://cdn.nba.com/logos/nba/${teamId}/primary/L/logo.svg`;

// --- COLOR SCALES ---
const getEfficiencyColor = (pct) => {
  if (pct === undefined || pct === null) return "#27272a"; // Default color for undefined values
  if (pct >= 60) return "#16a34a"; // Green for >= 50%
  if (pct >= 50) return "#84cc16"; // Lime for >= 30%
  if (pct >= 40) return "#eab308"; // Yellow for >= 25%
  if (pct >= 30) return "#f97316"; // Orange for >= 8%
  return "#ef4444"; // Red for < 8%
};

const getPointsPercentageColor = (pct) => {
  if (pct === undefined || pct === null) return "#27272a"; // Default color for undefined values
  if (pct >= 40) return "#16a34a"; // Green for >= 50%
  if (pct >= 25) return "#84cc16"; // Lime for >= 30%
  if (pct >= 15) return "#eab308"; // Yellow for >= 20%
  if (pct >= 6) return "#f97316"; // Orange for >= 9%
  return "#ef4444"; // Red for < 9%
};

const getDefenseColor = (rank) => {
  if (!rank) return "#27272a";
  if (rank <= 5) return "#ef4444"; 
  if (rank <= 12) return "#f97316";
  if (rank <= 18) return "#eab308";
  if (rank <= 25) return "#84cc16";
  return "#16a34a"; 
};

// --- SLIDER COMPONENT ---
const CustomSlider = ({ value, min, max, onChange, height }) => {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef(null);
  const range = (max - min) || 1; // Prevent divide by zero
  const percentage = Math.min(Math.max(((value - min) / range) * 100, 0), 100);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const bottomY = rect.bottom;
    const trackHeight = rect.height;
    let y = bottomY - e.clientY;
    if (y < 0) y = 0;
    if (y > trackHeight) y = trackHeight;
    const pct = y / trackHeight;
    const newValue = min + pct * (max - min);
    onChange(Math.round(newValue * 2) / 2);
  }, [isDragging, min, max, onChange]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={sliderRef} className="relative w-16 flex justify-center cursor-pointer select-none" style={{ height: height }} onMouseDown={() => setIsDragging(true)}>
      <div className="absolute w-1 bg-zinc-800 rounded-full h-full left-1/2 -translate-x-1/2"></div>
      <div className="absolute flex items-center justify-center bg-[#eab308] text-black font-bold text-xs rounded-md shadow-lg z-10 transition-transform active:scale-110"
        style={{ bottom: `${percentage}%`, transform: 'translateY(50%)', width: '42px', height: '26px', left: '50%', marginLeft: '-21px', cursor: isDragging ? 'grabbing' : 'grab' }}>
        {value}
      </div>
    </div>
  );
};

// --- COURT VISUAL ---
const ZONE_PATHS = {
  lc3: { d: "M 0 330 L 44 330 L 44 470 L 0 470 Z", x: 22, y: 410 },
  rc3: { d: "M 456 330 L 500 330 L 500 470 L 456 470 Z", x: 478, y: 410 },
  paint: { d: "M 170 470 L 170 280 L 330 280 L 330 470", x: 250, y: 340 },
  ra: { d: "M 210 417.5 A 40 40 0 0 1 290 417.5 L 290 470 L 210 470 Z", x: 250, y: 440 },
  mid: { d: "M 44 470 L 44 330 Q 250 100 456 330 L 456 470 L 330 470 L 330 280 L 170 280 L 170 470 Z", x: 250, y: 250 },
  ab3: { d: "M 0 330 L 44 330 Q 250 100 456 330 L 500 330 L 500 0 L 0 0 Z", x: 250, y: 100 }
};

const ZoneLabel = ({ x, y, zoneKey, data, mode, totalPoints, defenseRanks }) => {
  if (mode === 'DEF') {
    const rank = defenseRanks ? defenseRanks[zoneKey] : null;
    return (
      <g>
        <rect x={x - 24} y={y - 12} width="48" height="24" fill="white" rx="4" stroke="#d4d4d8" strokeWidth="1" shadow="sm" />
        <text x={x} y={y + 4} fontSize="11" textAnchor="middle" fill="black" fontWeight="800" style={{ pointerEvents: 'none' }}>
          #{rank || '-'}
        </text>
      </g>
    );
  }

  if (!data || data.pct === undefined) return null;
  
  const fga = data.fga || 0;
  const pct = data.pct || 0;
  const fgm = ((pct / 100) * fga);

  if (mode === 'CMB') {
    const rank = defenseRanks ? defenseRanks[zoneKey] : null;
    // Calculate % PTS for label
    const pointsPerShot = ['lc3', 'rc3', 'ab3'].includes(zoneKey) ? 3 : 2;
    const zonePoints = fgm * pointsPerShot;
    const distPct = totalPoints > 0 ? (zonePoints / totalPoints) * 100 : 0;

    return (
      <g>
        <rect x={x - 24} y={y - 16} width="48" height="32" fill="white" rx="4" stroke="#d4d4d8" strokeWidth="1" shadow="sm" />
        <text x={x} y={y - 2} fontSize="9" textAnchor="middle" fill="black" fontWeight="800" style={{ pointerEvents: 'none' }}>
          {Math.round(distPct)}%
        </text>
        <text x={x} y={y + 10} fontSize="9" textAnchor="middle" fill="#52525b" fontWeight="600" style={{ pointerEvents: 'none' }}>
          #{rank || '-'}
        </text>
      </g>
    );
  }

  // Mode 1: Distribution (% of Total Points)
  if (mode === 'DIST') {
      // Estimate points from this zone (3pts for corners/ab3, 2pts for others)
      const pointsPerShot = ['lc3', 'rc3', 'ab3'].includes(zoneKey) ? 3 : 2;
      const zonePoints = fgm * pointsPerShot;
      const distPct = totalPoints > 0 ? (zonePoints / totalPoints) * 100 : 0;
      
      return (
        <g>
          <rect x={x - 24} y={y - 12} width="48" height="24" fill="white" rx="4" stroke="#d4d4d8" strokeWidth="1" shadow="sm" />
          <text x={x} y={y + 4} fontSize="11" textAnchor="middle" fill="black" fontWeight="800" style={{ pointerEvents: 'none' }}>
            {Math.round(distPct)}%
          </text>
        </g>
      );
  }

  // Mode 2: Efficiency (Stacked Data)
  return (
    <g>
      <rect x={x - 24} y={y - 24} width="48" height="48" fill="white" rx="6" stroke="#d4d4d8" strokeWidth="1" shadow="sm" />
      {/* FG% */}
      <text x={x} y={y - 8} fontSize="12" textAnchor="middle" fill="black" fontWeight="900" style={{ pointerEvents: 'none' }}>
        {Math.round(pct)}%
      </text>
      {/* Made */}
      <text x={x} y={y + 5} fontSize="9" textAnchor="middle" fill="#16a34a" fontWeight="700" style={{ pointerEvents: 'none' }}>
        {fgm.toFixed(1)}m
      </text>
      {/* Attempts */}
      <text x={x} y={y + 16} fontSize="9" textAnchor="middle" fill="#52525b" fontWeight="600" style={{ pointerEvents: 'none' }}>
        {fga.toFixed(1)}a
      </text>
    </g>
  );
};

const CourtVisual = ({ zones, mode, defenseRanks }) => {
  if (!zones) return <div className="h-48 flex items-center justify-center text-zinc-600">Loading Zones...</div>;

  // Pre-calculate total points for the 'DIST' and 'CMB' mode
  let totalPoints = 0;
  if (mode === 'DIST' || mode === 'CMB') {
    Object.keys(zones).forEach(k => {
      const z = zones[k];
      if (z) {
         const pts = ((z.pct / 100) * z.fga) * (['lc3', 'rc3', 'ab3'].includes(k) ? 3 : 2);
         totalPoints += pts;
      }
    });
  }

  const getZoneColor = (key) => {
    const z = zones[key];
    const rank = defenseRanks ? defenseRanks[key] : null;

    if (mode === 'DIST') {
      // Calculate % PTS for color
      const pointsPerShot = ['lc3', 'rc3', 'ab3'].includes(key) ? 3 : 2;
      const zonePoints = z ? ((z.pct / 100) * z.fga) * pointsPerShot : 0;
      const distPct = totalPoints > 0 ? (zonePoints / totalPoints) * 100 : 0;
      return getPointsPercentageColor(distPct); // Use % PTS for color
    }

    if (mode === 'EFF') return getEfficiencyColor(z?.pct);
    if (mode === 'DEF') return getDefenseColor(rank);
    if (mode === 'CMB') {
         if (!z || !rank) return "#27272a";
         
         // Calculate % PTS for color adjustment
         const pointsPerShot = ['lc3', 'rc3', 'ab3'].includes(key) ? 3 : 2;
         const zonePoints = z ? ((z.pct / 100) * z.fga) * pointsPerShot : 0;
         const distPct = totalPoints > 0 ? (zonePoints / totalPoints) * 100 : 0;

         let volScore = 0;
         if (z.fga >= 5.0) volScore = 4;
         else if (z.fga >= 3.0) volScore = 3;
         else if (z.fga >= 1.5) volScore = 2;
         else if (z.fga >= 0.5) volScore = 1;
         
         let defScore = 0;
         if (rank > 25) defScore = 4;
         else if (rank > 20) defScore = 3;
         else if (rank > 10) defScore = 2;
         else if (rank > 5) defScore = 1;
         
         // Adjust color based on % PTS
         if (distPct < 10) return "#ef4444"; // Red for low % PTS
         
         // Average Score
         const avgScore = (volScore + defScore) / 2;
         
         // Map back to colors
         if (avgScore >= 3.5) return "#16a34a"; // Green
         if (avgScore >= 2.5) return "#84cc16"; // Lime
         if (avgScore >= 1.5) return "#eab308"; // Yellow
         if (avgScore >= 0.5) return "#f97316"; // Orange
         return "#ef4444"; // Red
    }
    return "#27272a";
  };

  return (
    <div className="relative w-full max-w-[500px] mx-auto">
      <svg viewBox="0 0 500 470" className="w-full h-auto">
        <rect width="500" height="470" fill="#18181b" />
        
        {/* Zones */}
        <g opacity={0.9}>
           {Object.entries(ZONE_PATHS).map(([key, { d }]) => (
             <path key={key} d={d} fill={getZoneColor(key)} stroke="#09090b" strokeWidth="2" />
           ))}
        </g>

        {/* Court Lines */}
        <g fill="none" stroke="#000000" strokeWidth="2">
          <circle cx="250" cy="417.5" r="7.5" stroke="#f59e0b" />
          <path d="M 44 470 L 44 330 Q 250 100 456 330 L 456 470" />
          <rect x="170" y="280" width="160" height="190" />
        </g>

        {/* Labels */}
        <g>
          {Object.entries(ZONE_PATHS).map(([key, { x, y }]) => (
            <ZoneLabel 
              key={key} 
              x={x} 
              y={y} 
              zoneKey={key} 
              data={zones[key]} 
              mode={mode} 
              totalPoints={totalPoints} 
              defenseRanks={defenseRanks}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};


// --- CHART ---
const CustomAxisTick = ({ x, y, payload, data }) => {
  if (!data || !payload) return null;
  const match = data.find(d => d.date === payload.value);
  const opp = match ? match.opp : '';
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={10} textAnchor="middle" fill="#71717a" fontSize="10">{payload.value}</text>
      <text x={0} y={0} dy={22} textAnchor="middle" fill="#a1a1aa" fontSize="9" fontWeight="bold">{opp}</text>
    </g>
  );
};

const RecentGamesChart = ({ games, line, statKey, yMax }) => {
  if (!games) return null;
  const data = [...games].reverse().map(g => ({
    date: g.GAME_DATE.slice(0, 6),
    opp: g.OPP, 
    value: g[statKey], 
    result: g.WL,
    isOver: g[statKey] >= line 
  })); 

  return (
    <div className="h-72 w-full mt-4 relative">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ bottom: 20, right: 10, left: 0, top: 10 }}>
          <XAxis dataKey="date" axisLine={false} tickLine={false} interval={0} tick={<CustomAxisTick data={data} />} />
          <YAxis axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 10}} width={30} domain={[0, yMax]} allowDataOverflow={true} />
          <Tooltip contentStyle={{backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff'}} cursor={{fill: '#27272a', opacity: 0.4}} />
          <ReferenceLine y={line} stroke="#eab308" strokeDasharray="3 3" isFront={true} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.isOver ? '#16a34a' : '#f43f5e'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- TOGGLES ---
const SegmentedToggle = ({ options, value, onChange }) => (
  <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
    {options.map(opt => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
          value === opt.value
            ? 'bg-zinc-700 text-white shadow-sm' 
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// --- MAIN APP ---
export default function App() {
  const [activePlayerId, setActivePlayerId] = useState("2544");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [gameCount, setGameCount] = useState(15); 
  const [expandedTeams, setExpandedTeams] = useState(["LAL"]);
  
  const [statMode, setStatMode] = useState('PTS');
  const [customLine, setCustomLine] = useState(0);
  const [heatmapMode, setHeatmapMode] = useState('DIST'); 

  const [teamSchedules, setTeamSchedules] = useState({});
  const [playersList, setPlayersList] = useState([]);
  const [defenseRanks, setDefenseRanks] = useState({});

  const TEAM_IDS = {
    'ATL': 1610612737, 'BOS': 1610612738, 'CLE': 1610612739, 'NOP': 1610612740,
    'CHI': 1610612741, 'DAL': 1610612742, 'DEN': 1610612743, 'GSW': 1610612744,
    'HOU': 1610612745, 'LAC': 1610612746, 'LAL': 1610612747, 'MIA': 1610612748,
    'MIL': 1610612749, 'MIN': 1610612750, 'BKN': 1610612751, 'NYK': 1610612752,
    'ORL': 1610612753, 'IND': 1610612754, 'PHI': 1610612755, 'PHX': 1610612756,
    'POR': 1610612757, 'SAC': 1610612758, 'SAS': 1610612759, 'OKC': 1610612760,
    'TOR': 1610612761, 'UTA': 1610612762, 'MEM': 1610612763, 'WAS': 1610612764,
    'DET': 1610612765, 'CHA': 1610612766
  };

  useEffect(() => {
    const initData = async () => {
      try {
        const [schedRes, rosterRes, defRes] = await Promise.all([
          fetch('http://127.0.0.1:5000/api/schedule'),
          fetch('http://127.0.0.1:5000/api/roster'),
          fetch('http://127.0.0.1:5000/api/defense_ranks')
        ]);
        if (schedRes.ok) setTeamSchedules(await schedRes.json());
        if (rosterRes.ok) setPlayersList(await rosterRes.json());
        if (defRes.ok) setDefenseRanks(await defRes.json());
      } catch (e) { console.error("Init fetch failed:", e); }
    };
    initData();
  }, []);

  const teams = [...new Set(playersList.map(p => p.team))].sort((a, b) => {
    const sA = teamSchedules[a];
    const sB = teamSchedules[b];
    const orderA = sA?.sortOrder ?? 99;
    const orderB = sB?.sortOrder ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    if (sA && sB) return sA.time.localeCompare(sB.time);
    return 0;
  });

  useEffect(() => {
    setGameCount(15);
    fetchData(activePlayerId);
  }, [activePlayerId]);

  const fetchData = async (pid) => {
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/player/${pid}`);
      if (!res.ok) throw new Error("Backend Error");
      setData(await res.json());
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!data || !data.stats) return;
    let avg = 0;
    switch(statMode) {
      case 'PTS': avg = data.stats.ppg; break;
      case 'REB': avg = data.stats.rpg; break;
      case 'AST': avg = data.stats.apg; break;
      case 'PTS+REB': avg = data.stats.avg_pts_reb; break;
      case 'PTS+AST': avg = data.stats.avg_pts_ast; break;
      case 'REB+AST': avg = data.stats.avg_reb_ast; break;
      case 'PRA': avg = data.stats.avg_pra; break;
      default: avg = 0;
    }
    setCustomLine(avg || 0);
  }, [data, statMode]);

  const toggleTeam = (team) => {
    setExpandedTeams(prev => prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team]);
  };

  const STAT_TABS = [
    { id: 'PTS', label: 'Points' },
    { id: 'REB', label: 'Rebounds' },
    { id: 'AST', label: 'Assists' },
    { id: 'PRA', label: 'Pts+Reb+Ast' }, 
    { id: 'REB+AST', label: 'Reb+Ast' },
    { id: 'PTS+REB', label: 'Pts+Reb' },
    { id: 'PTS+AST', label: 'Pts+Ast' },
  ];

  // CRITICAL CRASH FIX: Guard against null data here
  if (!data || !data.stats || !data.recentGames) {
     return (
        <div className={`h-screen w-full ${THEME.bg} ${THEME.text} font-sans flex items-center justify-center`}>
           {loading ? <Zap className="animate-spin text-emerald-500" /> : "Select a player to begin"}
        </div>
     );
  }

  const processedGames = data.recentGames.map(g => ({
      ...g,
      'PTS+REB': (g.PTS || 0) + (g.REB || 0),
      'PTS+AST': (g.PTS || 0) + (g.AST || 0),
      'REB+AST': (g.REB || 0) + (g.AST || 0),
      'PRA': (g.PTS || 0) + (g.REB || 0) + (g.AST || 0)
  })).slice(0, gameCount);

  const maxStatValue = processedGames.length > 0 ? Math.max(...processedGames.map(g => g[statMode])) : 50;
  const yMax = Math.ceil(maxStatValue + 5);
  
  const currentPlayerObj = playersList.find(p => p.id === activePlayerId);
  const playerTeam = currentPlayerObj ? currentPlayerObj.team : null;
  const nextGame = playerTeam ? teamSchedules[playerTeam] : null;
  const nextOpponent = nextGame ? nextGame.opponent : null;
  const opponentRanks = nextOpponent && defenseRanks[nextOpponent] ? defenseRanks[nextOpponent] : null;

  return (
    <div className={`h-screen w-full ${THEME.bg} ${THEME.text} font-sans flex overflow-hidden`}>
      <aside className="w-80 border-r border-zinc-800 flex flex-col bg-[#09090b] hidden md:flex shrink-0">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2 font-bold text-lg text-white">
             <Activity className="text-emerald-500" size={20} />
             <span>NBA Tracker</span>
        </div>
        <div className="p-4 bg-[#121214] border-b border-zinc-800">
           <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
             <Calendar size={12} /> Upcoming Games (7 Days)
           </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4 pt-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {teams.map(team => {
            const isExpanded = expandedTeams.includes(team);
            const schedule = teamSchedules[team] || {};
            const hasGame = !!schedule.opponent;
            
            const homePlayers = playersList.filter(p => p.team === team);
            const oppPlayers = hasGame ? playersList.filter(p => p.team === schedule.opponent) : [];
            
            return (
              <div key={team} className="bg-[#18181b] rounded-xl overflow-hidden border border-zinc-800">
                <button onClick={() => toggleTeam(team)} className="w-full block hover:bg-zinc-800/50 transition-colors">
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex flex-col items-center gap-1 w-14">
                        <div className="w-10 h-10 rounded-full bg-white p-1 flex items-center justify-center">
                            <img 
                              src={getTeamLogo(TEAM_IDS[team])} 
                              alt={team} 
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.target.onerror = null; 
                                e.target.src = 'https://cdn.nba.com/headshots/nba/latest/1040x760/logoman.png';
                              }}
                            />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400">{team}</span>
                    </div>

                    <div className="flex-1 flex flex-col items-center text-center px-1">
                        {hasGame ? (
                            <>
                                <span className={`${schedule.day === 'Today' ? 'text-emerald-400' : 'text-zinc-300'} text-xs font-bold`}>
                                    {schedule.day}
                                </span>
                                <span className="text-[10px] text-zinc-500">{schedule.time}</span>
                            </>
                        ) : (
                            <span className="text-[10px] text-zinc-600 italic">No Game</span>
                        )}
                    </div>

                    <div className="flex flex-col items-center gap-1 w-14">
                        {hasGame ? (
                            <>
                                <div className="w-10 h-10 rounded-full bg-white p-1 flex items-center justify-center">
                                    <img 
                                      src={getTeamLogo(schedule.opponentId)} 
                                      alt={schedule.opponent} 
                                      className="w-full h-full object-contain"
                                      onError={(e) => {
                                        e.target.onerror = null; 
                                        e.target.src = 'https://cdn.nba.com/headshots/nba/latest/1040x760/logoman.png';
                                      }}
                                    />
                                </div>
                                <span className="text-[10px] font-bold text-zinc-400">{schedule.opponent}</span>
                            </>
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-700 text-[10px]">-</div>
                        )}
                    </div>
                  </div>
                  
                  <div className="bg-[#121214] py-1 flex justify-center border-t border-zinc-800">
                     {isExpanded ? <ChevronDown size={12} className="text-zinc-600" /> : <ChevronRight size={12} className="text-zinc-600" />}
                  </div>
                </button>
                
                {isExpanded && (
                  <div className="bg-[#09090b]/50 border-t border-zinc-800 p-1">
                    {homePlayers.map(p => (
                      <div key={p.id} onClick={() => setActivePlayerId(p.id)} className={`p-2 m-1 rounded-lg cursor-pointer flex items-center gap-3 transition-all ${activePlayerId === p.id ? 'bg-zinc-800 border border-zinc-700 shadow-sm' : 'hover:bg-zinc-800/50 border border-transparent'}`}>
                        <img src={p.img} alt={p.name} className="w-8 h-8 rounded-full bg-zinc-800 object-cover" />
                        <div className="text-sm font-medium text-zinc-300">{p.name}</div>
                      </div>
                    ))}
                    {oppPlayers.length > 0 && (
                      <>
                        <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-t border-zinc-800 mt-2">Opponent: {schedule.opponent}</div>
                        {oppPlayers.map(p => (
                          <div key={p.id} onClick={() => setActivePlayerId(p.id)} className={`p-2 m-1 rounded-lg cursor-pointer flex items-center gap-3 transition-all ${activePlayerId === p.id ? 'bg-zinc-800 border border-zinc-700 shadow-sm' : 'hover:bg-zinc-800/50 border border-transparent'}`}>
                            <img src={p.img} alt={p.name} className="w-8 h-8 rounded-full bg-zinc-800 object-cover" />
                            <div className="text-sm font-medium text-zinc-300">{p.name}</div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
         {/* Header etc omitted for brevity, same as before */}
         {loading ? (
           <div className="flex-1 flex items-center justify-center"><Zap className="animate-spin text-emerald-500"/></div> 
         ) : (
           <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
              {/* Top Card */}
              <div className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800 shadow-xl">
                 <div className="flex gap-4 items-center mb-6">
                    <img 
                      src={currentPlayerObj ? currentPlayerObj.img : `https://cdn.nba.com/headshots/nba/latest/1040x760/${activePlayerId}.png`} 
                      className="w-20 h-20 rounded-full bg-zinc-900 border-2 border-zinc-700 object-cover"
                      onError={(e) => {e.target.src = 'https://via.placeholder.com/150?text=NBA'}}
                    />
                    <div><h1 className="text-2xl font-bold">{data.stats.name}</h1><span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">2025-2026 Season</span></div>
                 </div>
                 <div className="flex gap-2 mb-4 overflow-x-auto">{STAT_TABS.map(t=><button key={t.id} onClick={()=>setStatMode(t.id)} className={`px-3 py-1 rounded text-xs font-bold ${statMode===t.id?'bg-emerald-600':'bg-zinc-900 text-zinc-500'}`}>{t.label}</button>)}</div>
                 <div className="flex justify-between items-end mb-4">
                    <div><h3 className="text-sm font-bold text-zinc-400">{statMode} vs Line</h3></div>
                    <SegmentedToggle options={[{label:'L5',value:5},{label:'L10',value:10},{label:'L15',value:15}]} value={gameCount} onChange={setGameCount}/>
                 </div>
                 <div className="flex flex-row items-center w-full">
                    <div className="h-64 pt-4 mr-2"><CustomSlider value={customLine} min={0} max={yMax} onChange={setCustomLine} height="100%"/></div>
                    <RecentGamesChart games={processedGames} line={customLine} statKey={statMode} yMax={yMax} />
                 </div>
              </div>

              {/* Bottom Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800">
                    <div className="flex justify-between mb-6">
                       <h3 className="font-bold text-zinc-200">Season Heatmap</h3>
                       <SegmentedToggle options={[{label:'% PTS',value:'DIST'},{label:'FG Data',value:'EFF'},{label:'Matchup',value:'CMB'},{label:'Opp Def',value:'DEF'}]} value={heatmapMode} onChange={setHeatmapMode}/>
                    </div>
                    <CourtVisual zones={data.zones} mode={heatmapMode} defenseRanks={opponentRanks} />
                    <div className="mt-4 flex justify-center gap-4 text-[10px] text-zinc-500">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#16a34a]"></div> Good</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Avg</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Bad</div>
                    </div>
                 </div>
                 {/* Matchups Table */}
                 <div className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800"><h3 className="font-bold text-zinc-200 mb-4">Recent Matchups</h3>
                    <div className="overflow-auto max-h-[400px]"><table className="w-full text-sm text-left"><thead className="text-zinc-500 border-b border-zinc-800"><tr><th className="pb-2">Date</th><th>Opp</th><th className="text-right">{statMode}</th></tr></thead><tbody>{processedGames.map((g,i)=><tr key={i} className="hover:bg-zinc-900/50"><td className="py-3 text-zinc-400">{g.GAME_DATE}</td><td className="font-bold">{g.MATCHUP}</td><td className={`text-right font-bold ${g[statMode]>=customLine?'text-emerald-500':'text-zinc-500'}`}>{g[statMode]}</td></tr>)}</tbody></table></div>
                 </div>
              </div>
         </div>
         )}
      </main>
    </div>
  );
}