import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  BookOpen,
  Brain,
  Dices,
  FlaskConical,
  History,
  Play,
  RotateCcw,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  computePlayerTwoChaseOdds,
  computePlayerTwoLandingDistribution,
  formatPercent,
  nextRollOutcomes,
  POLICY,
  resolvePlayerTwo,
  rollTwoDice,
  simulateThresholdGames,
  stateForTotal,
  type OutcomeOdds,
  type SimulationSummary,
} from './gameMath';

type Page = 'play' | 'rules' | 'how' | 'simulation';
type GamePhase = 'playing' | 'stood' | 'bust' | 'win';

type HistoryPoint = {
  rollNumber: number;
  total: number;
  optimalWinPercent: number;
  optimalTiePercent: number;
  optimalLossPercent: number;
};

type LastRoll = {
  dieOne: number;
  dieTwo: number;
  total: number;
} | null;

type PlayerTwoResult = ReturnType<typeof resolvePlayerTwo> | null;

type PlayerTwoReveal = {
  roll: number;
  total: number;
  odds: OutcomeOdds;
};

const decisionText = {
  roll: 'Roll',
  stand: 'Stand',
  win: 'Already won',
  bust: 'Busted',
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function buildHistoryPoint(rollNumber: number, total: number): HistoryPoint {
  const nextState = stateForTotal(total);

  return {
    rollNumber,
    total,
    optimalWinPercent: Number((nextState.optimal.win * 100).toFixed(2)),
    optimalTiePercent: Number((nextState.optimal.tie * 100).toFixed(2)),
    optimalLossPercent: Number((nextState.optimal.loss * 100).toFixed(2)),
  };
}

function StatCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function OddsGrid({ title, odds }: { title: string; odds: OutcomeOdds }) {
  const rows = [
    { label: 'Win', value: odds.win, className: 'win' },
    { label: 'Tie', value: odds.tie, className: 'tie' },
    { label: 'Loss', value: odds.loss, className: 'loss' },
  ];

  return (
    <section className="odds-panel">
      <h3>{title}</h3>
      <div className="odds-bars">
        {rows.map((row) => (
          <div className="odds-row" key={row.label}>
            <div className="odds-label">
              <span>{row.label}</span>
              <strong>{formatPercent(row.value)}</strong>
            </div>
            <div className="odds-track">
              <div
                className={`odds-fill ${row.className}`}
                style={{ width: `${row.value * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DiceFace({ value, rolling = false }: { value: number | null; rolling?: boolean }) {
  return <div className={`die-face ${rolling ? 'rolling' : ''}`}>{value ?? '-'}</div>;
}

function OutcomeMosaic({ odds }: { odds: OutcomeOdds }) {
  const cells = [
    { label: 'Win', value: odds.win, className: 'win' },
    { label: 'Tie', value: odds.tie, className: 'tie' },
    { label: 'Loss', value: odds.loss, className: 'loss' },
  ];

  return (
    <div className="outcome-mosaic">
      {cells.map((cell) => (
        <div
          className={`outcome-tile ${cell.className}`}
          key={cell.label}
        >
          <span>{cell.label}</span>
          <strong>{formatPercent(cell.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function RulesPage() {
  return (
    <main className="content-page">
      <section className="page-header">
        <BookOpen size={24} />
        <div>
          <p>Rules</p>
          <h1>Two dice, one stand decision, no second chances.</h1>
        </div>
      </section>

      <div className="rules-grid">
        <article>
          <h2>Player 1</h2>
          <p>
            Roll two dice and build a running total. You can keep rolling, or
            stand once you like the number.
          </p>
          <ul>
            <li>Go over 21 and you bust immediately.</li>
            <li>Hit exactly 21 and you win immediately.</li>
            <li>Stand below 21 and Player 2 starts rolling.</li>
          </ul>
        </article>
        <article>
          <h2>Player 2</h2>
          <p>
            Player 2 rolls two dice until the result is decided against Player
            1&apos;s standing total.
          </p>
          <ul>
            <li>Player 2 busts over 21, so Player 1 wins.</li>
            <li>Player 2 matches Player 1, so the game ties.</li>
            <li>Player 2 passes Player 1 without busting, so Player 1 loses.</li>
          </ul>
        </article>
      </div>
    </main>
  );
}

function HowItWorksPage() {
  const [chartMode, setChartMode] = useState<'stand' | 'optimal' | 'both'>('both');
  const [selectedTotal, setSelectedTotal] = useState(16);
  const decisionRows = Object.values(POLICY)
    .filter((state) => state.total <= 21)
    .sort((a, b) => a.total - b.total)
    .map((state) => ({
      total: state.total,
      optimalWin: Number((state.optimal.win * 100).toFixed(2)),
      standWin: Number((state.stand.win * 100).toFixed(2)),
      standTie: Number((state.stand.tie * 100).toFixed(2)),
      standLoss: Number((state.stand.loss * 100).toFixed(2)),
      decision: state.decision === 'stand' ? 1 : 0,
    }));
  const selectedState = stateForTotal(selectedTotal);
  const landingRows = useMemo(
    () => computePlayerTwoLandingDistribution(selectedTotal),
    [selectedTotal],
  );

  return (
    <main className="content-page">
      <section className="page-header">
        <Brain size={24} />
        <div>
          <p>Dynamic Programming</p>
          <h1>Work backward from the end, then choose the stronger move.</h1>
        </div>
      </section>

      <div className="explain-flow">
        <article>
          <span>1</span>
          <h2>Define the state</h2>
          <p>
            A state is just Player 1&apos;s current total. For each total, the
            model stores the chance of a win, tie, and loss. The notebook keeps
            these as dictionaries, then reuses them as it walks backward.
          </p>
        </article>
        <article>
          <span>2</span>
          <h2>Compute stand first</h2>
          <p>
            If Player 1 stands at x, Player 2 starts at 0. Every active Player
            2 total is split across the eleven possible two-dice sums. Passing x
            is a loss, matching x is a tie, and busting over 21 is a win.
          </p>
        </article>
        <article>
          <span>3</span>
          <h2>Lock the endpoints</h2>
          <p>
            Totals above 21 are losses. A total of 21 is a win. Those known
            outcomes let the dynamic program fill in totals 20 down to 0.
          </p>
        </article>
        <article>
          <span>4</span>
          <h2>Compare stand versus roll</h2>
          <p>
            Roll value is the weighted average of future optimal states. Stand
            value is the Player 2 chase calculation. The notebook chooses the
            action with the larger win probability, so standing begins at 16.
          </p>
        </article>
      </div>

      <section className="chart-panel wide">
        <div className="section-title split">
          <div>
            <Target size={18} />
            <h2>Notebook strategy charts</h2>
          </div>
          <div className="segmented">
            {(['stand', 'optimal', 'both'] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className={chartMode === mode ? 'active' : ''}
                onClick={() => setChartMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={decisionRows} margin={{ left: 6, right: 12, top: 12, bottom: 0 }}>
            <CartesianGrid stroke="#e4ded1" strokeDasharray="4 4" />
            <XAxis dataKey="total" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} unit="%" domain={[0, 100]} width={42} />
            <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
            {(chartMode === 'stand' || chartMode === 'both') && (
              <>
                <Line type="monotone" dataKey="standWin" stroke="#2f6f68" strokeWidth={3} name="Stand win" />
                <Line type="monotone" dataKey="standTie" stroke="#b3842f" strokeWidth={2} name="Stand tie" />
                <Line type="monotone" dataKey="standLoss" stroke="#9f4d45" strokeWidth={2} name="Stand loss" />
              </>
            )}
            {(chartMode === 'optimal' || chartMode === 'both') && (
              <Area
                type="monotone"
                dataKey="optimalWin"
                stroke="#26211b"
                fill="#26211b1a"
                strokeWidth={3}
                name="Optimal win"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      <section className="notebook-panel">
        <div>
          <p className="eyebrow">Stand calculation</p>
          <h2>What happens when Player 2 chases a held total?</h2>
          <p>
            The stand calculation is a small probability machine. It keeps a
            frontier of Player 2 totals that have not finished yet. For each
            frontier total, it distributes probability across dice sums 2
            through 12. Finished branches are added into win, tie, or loss
            buckets; unfinished branches stay in the frontier for the next pass.
          </p>
        </div>
        <div className="total-picker">
          <label htmlFor="stand-total">Held total</label>
          <input
            id="stand-total"
            type="range"
            min="2"
            max="20"
            value={selectedTotal}
            onChange={(event) => setSelectedTotal(Number(event.target.value))}
          />
          <strong>{selectedTotal}</strong>
        </div>
        <OutcomeMosaic odds={selectedState.stand} />
        <div className="landing-list">
          <h3>Likely Player 2 landing totals</h3>
          <div>
            {landingRows.map((row) => (
              <span className={row.result} key={row.total}>
                <strong>{row.total}</strong>
                {row.probabilityPercent.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function SimulationPage() {
  const [threshold, setThreshold] = useState(16);
  const [games, setGames] = useState(10000);
  const [summary, setSummary] = useState<SimulationSummary>(() =>
    simulateThresholdGames(16, 10000),
  );
  const chartRows = [
    {
      name: 'Win',
      simulated: Number((summary.simulated.win * 100).toFixed(2)),
      exact: Number((summary.exact.win * 100).toFixed(2)),
    },
    {
      name: 'Tie',
      simulated: Number((summary.simulated.tie * 100).toFixed(2)),
      exact: Number((summary.exact.tie * 100).toFixed(2)),
    },
    {
      name: 'Loss',
      simulated: Number((summary.simulated.loss * 100).toFixed(2)),
      exact: Number((summary.exact.loss * 100).toFixed(2)),
    },
  ];
  const p1DistributionRows = summary.p1Totals.map((row) => ({
    total: row.value,
    probability: Number(row.probabilityPercent.toFixed(2)),
  }));
  const p2DistributionRows = summary.p2Totals.map((row) => ({
    total: row.value === 0 ? 'No P2' : row.value,
    probability: Number(row.probabilityPercent.toFixed(2)),
  }));

  function runSimulation() {
    setSummary(simulateThresholdGames(threshold, games));
  }

  return (
    <main className="content-page">
      <section className="page-header">
        <FlaskConical size={24} />
        <div>
          <p>Simulation Lab</p>
          <h1>Pick a standing threshold and watch randomness chase the math.</h1>
        </div>
      </section>

      <section className="simulation-controls">
        <div>
          <label htmlFor="threshold">Stand when total is at least</label>
          <input
            id="threshold"
            type="range"
            min="2"
            max="21"
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
          />
          <strong>{threshold}</strong>
        </div>
        <div>
          <label htmlFor="games">Games</label>
          <input
            id="games"
            type="number"
            min="100"
            max="100000"
            step="100"
            value={games}
            onChange={(event) => setGames(Number(event.target.value))}
          />
        </div>
        <button type="button" onClick={runSimulation}>
          <SlidersHorizontal size={18} />
          Simulate
        </button>
      </section>

      <div className="stat-grid simulation-stats">
        <StatCard label="Sim win" value={formatPercent(summary.simulated.win)} detail={`${summary.wins} wins`} tone="good" />
        <StatCard label="Exact win" value={formatPercent(summary.exact.win)} detail={`Threshold ${summary.threshold}`} tone="good" />
        <StatCard label="Sim tie" value={formatPercent(summary.simulated.tie)} detail={`${summary.ties} ties`} tone="warn" />
        <StatCard label="Sim loss" value={formatPercent(summary.simulated.loss)} detail={`${summary.losses} losses`} tone="bad" />
      </div>

      <section className="chart-panel wide">
        <div className="section-title">
          <BarChart3 size={18} />
          <h2>Simulation versus exact probability</h2>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartRows} margin={{ left: 6, right: 12, top: 12, bottom: 0 }}>
            <CartesianGrid stroke="#e4ded1" strokeDasharray="4 4" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} unit="%" domain={[0, 100]} width={42} />
            <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
            <Bar dataKey="simulated" fill="#2f6f68" name="Simulated" radius={[5, 5, 0, 0]} />
            <Line dataKey="exact" stroke="#26211b" strokeWidth={3} name="Exact" />
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      <section className="chart-panel wide">
        <div className="section-title">
          <BarChart3 size={18} />
          <h2>Actual totals seen in the simulation</h2>
        </div>
        <div className="distribution-grid">
          <div>
            <h3>Player 1 stop totals</h3>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={p1DistributionRows} margin={{ left: 6, right: 12, top: 12, bottom: 0 }}>
                <CartesianGrid stroke="#e4ded1" strokeDasharray="4 4" />
                <XAxis dataKey="total" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} unit="%" width={42} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                <Bar dataKey="probability" fill="#2f6f68" name="P1 total" radius={[5, 5, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3>Player 2 final totals</h3>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={p2DistributionRows} margin={{ left: 6, right: 12, top: 12, bottom: 0 }}>
                <CartesianGrid stroke="#e4ded1" strokeDasharray="4 4" />
                <XAxis dataKey="total" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} unit="%" width={42} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                <Bar dataKey="probability" fill="#b3842f" name="P2 final total" radius={[5, 5, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </main>
  );
}

function PlayPage() {
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<GamePhase>('playing');
  const [lastRoll, setLastRoll] = useState<LastRoll>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [statsMode, setStatsMode] = useState(true);
  const [playerTwo, setPlayerTwo] = useState<PlayerTwoResult>(null);
  const [playerTwoReveals, setPlayerTwoReveals] = useState<PlayerTwoReveal[]>([]);
  const [rolling, setRolling] = useState(false);
  const [playerTwoRolling, setPlayerTwoRolling] = useState(false);

  const state = stateForTotal(total);
  const nextRollData = useMemo(() => nextRollOutcomes(total), [total]);
  const historyWithInitial = useMemo(() => [buildHistoryPoint(0, 0), ...history], [history]);
  const canRoll = phase === 'playing' && !rolling && !playerTwoRolling;
  const canStand = phase === 'playing' && total > 0 && total < 21 && !rolling && !playerTwoRolling;
  const statusLabel =
    phase === 'win'
      ? 'Player 1 hit 21'
      : phase === 'bust'
        ? 'Player 1 busted'
        : phase === 'stood'
          ? playerTwo?.message
          : total === 0
            ? 'Roll to begin'
            : 'Choose the next move';

  function resetGame() {
    setTotal(0);
    setPhase('playing');
    setLastRoll(null);
    setHistory([]);
    setPlayerTwo(null);
    setPlayerTwoReveals([]);
    setRolling(false);
    setPlayerTwoRolling(false);
  }

  function recordHistory(nextTotal: number) {
    setHistory((items) => [
      ...items,
      buildHistoryPoint(items.length + 1, nextTotal),
    ]);
  }

  async function handleRoll() {
    if (!canRoll) return;

    setRolling(true);
    setPlayerTwo(null);
    setPlayerTwoReveals([]);

    let roll = rollTwoDice();

    for (let tick = 0; tick < 8; tick += 1) {
      roll = rollTwoDice();
      setLastRoll(roll);
      await sleep(70);
    }

    const nextTotal = total + roll.total;

    setLastRoll(roll);
    setTotal(nextTotal);
    recordHistory(nextTotal);
    setPlayerTwo(null);

    if (nextTotal > 21) {
      setPhase('bust');
    } else if (nextTotal === 21) {
      setPhase('win');
    }

    setRolling(false);
  }

  async function handleStand() {
    if (!canStand) return;

    setPlayerTwoRolling(true);
    setPlayerTwo(null);
    setPlayerTwoReveals([]);
    const result = resolvePlayerTwo(total);

    let runningTotal = 0;
    for (const roll of result.rolls) {
      await sleep(650);
      runningTotal += roll;
      setPlayerTwoReveals((items) => [
        ...items,
        {
          roll,
          total: runningTotal,
          odds: computePlayerTwoChaseOdds(total, runningTotal),
        },
      ]);
    }

    setPlayerTwo(result);
    setPhase('stood');
    setPlayerTwoRolling(false);
  }

  return (
    <main className="play-grid">
      <section className="game-panel">
        <div className="game-panel-top">
          <div>
            <p className="eyebrow">Player 1</p>
            <h1>Quick Dice</h1>
          </div>
          <span className={`phase-pill ${phase}`}>{statusLabel}</span>
        </div>

        <div className={`scoreboard ${statsMode ? '' : 'scoreboard-quiet'}`}>
          <div>
            <span>Total</span>
            <strong>{total}</strong>
          </div>
          <div>
            <span>Target</span>
            <strong>21</strong>
          </div>
          {statsMode ? (
            <div>
              <span>Optimal</span>
              <strong>{decisionText[state.decision]}</strong>
            </div>
          ) : (
            <div>
              <span>Rolls</span>
              <strong>{history.length}</strong>
            </div>
          )}
        </div>

        <div className="dice-row" aria-label="Last dice roll">
          <DiceFace value={lastRoll?.dieOne ?? null} rolling={rolling} />
          <DiceFace value={lastRoll?.dieTwo ?? null} rolling={rolling} />
          <div className="roll-summary">
            <span>Last roll</span>
            <strong>{lastRoll ? `+${lastRoll.total}` : 'Ready'}</strong>
          </div>
        </div>

        <div className="action-row">
          <button type="button" onClick={handleRoll} disabled={!canRoll} className="primary">
            <Dices size={18} />
            Roll
          </button>
          <button type="button" onClick={handleStand} disabled={!canStand}>
            <ShieldCheck size={18} />
            Stand
          </button>
          <button type="button" onClick={resetGame} className="ghost">
            <RotateCcw size={18} />
            New Game
          </button>
        </div>

        {(playerTwoRolling || playerTwoReveals.length > 0) && (
          <section className="p2-rolls">
            <h2>Player 2 rolls</h2>
            <div>
              {playerTwoReveals.map((item, index) => (
                <article key={`${item.roll}-${index}`}>
                  <header>
                    <strong>+{item.roll}</strong>
                    <span>Total {item.total}</span>
                  </header>
                  <div className="p2-odds">
                    <span className="win">W {formatPercent(item.odds.win, 0)}</span>
                    <span className="tie">T {formatPercent(item.odds.tie, 0)}</span>
                    <span className="loss">L {formatPercent(item.odds.loss, 0)}</span>
                  </div>
                </article>
              ))}
              {playerTwoRolling && <article className="pending">Rolling...</article>}
            </div>
          </section>
        )}

        {playerTwo && (
          <section className={`resolution ${playerTwo.result}`}>
            <h2>Player 2 finished at {playerTwo.total}</h2>
            <p>{playerTwo.message}</p>
            <span>Rolls: {playerTwo.rolls.join(' + ')}</span>
          </section>
        )}
      </section>

      <aside className="stats-shell">
        <div className="stats-top">
          <div>
            <p className="eyebrow">Strategy Desk</p>
            <h2>Live probabilities</h2>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={statsMode}
              onChange={(event) => setStatsMode(event.target.checked)}
            />
            <span />
            Stats
          </label>
        </div>

        {statsMode ? (
          <>
            <div className="stat-grid live-stat-grid">
              <StatCard
                label="Optimal action"
                value={decisionText[state.decision]}
                detail="Win-max policy"
                tone={state.decision === 'stand' ? 'warn' : state.decision === 'win' ? 'good' : 'neutral'}
              />
              <StatCard
                label="Optimal win"
                value={formatPercent(state.optimal.win)}
                detail="Best available move"
                tone="good"
              />
            </div>

            <div className="odds-grid">
              <OddsGrid title="Stand outcomes" odds={state.stand} />
              <OddsGrid title="Roll outcomes" odds={state.roll} />
            </div>

            <section className="chart-panel">
              <div className="section-title">
                <BarChart3 size={18} />
                <h3>Next roll map</h3>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={nextRollData} margin={{ left: 2, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#e4ded1" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    width={42}
                    unit="%"
                  />
                  <YAxis yAxisId="right" orientation="right" hide domain={[0, 100]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as (typeof nextRollData)[number];
                      return (
                        <div className="chart-tooltip">
                          <strong>Roll {row.roll}</strong>
                          <span>{row.probabilityPercent.toFixed(1)}% chance</span>
                          <span>Total becomes {row.resultingTotal}</span>
                          <span>{row.outcome}</span>
                          <span>Optimal win {row.optimalWinPercent.toFixed(1)}%</span>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="probabilityPercent"
                    name="Roll probability"
                    radius={[5, 5, 0, 0]}
                  >
                    {nextRollData.map((entry) => (
                      <Cell
                        key={entry.roll}
                        fill={
                          entry.outcome === 'Bust'
                            ? '#9f4d45'
                            : entry.outcome === '21'
                              ? '#b3842f'
                              : '#2f6f68'
                        }
                      />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="optimalWinPercent"
                    stroke="#26211b"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    name="Optimal win"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </section>

            <section className="chart-panel">
              <div className="section-title">
                <History size={18} />
                <h3>Outcome-percentage history</h3>
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={historyWithInitial} margin={{ left: 2, right: 10, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#e4ded1" strokeDasharray="4 4" />
                  <XAxis dataKey="rollNumber" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    unit="%"
                    width={42}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    formatter={(value) => `${Number(value).toFixed(1)}%`}
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload as HistoryPoint | undefined;
                      return row ? `Roll ${label} · Total ${row.total}` : `Roll ${label}`;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="optimalWinPercent"
                    stroke="#2f6f68"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#f7f3ea' }}
                    name="Optimal win"
                  />
                  <Line
                    type="monotone"
                    dataKey="optimalTiePercent"
                    stroke="#b3842f"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#f7f3ea' }}
                    name="Optimal tie"
                  />
                  <Line
                    type="monotone"
                    dataKey="optimalLossPercent"
                    stroke="#9f4d45"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#f7f3ea' }}
                    name="Optimal loss"
                  />
                </LineChart>
              </ResponsiveContainer>
            </section>
          </>
        ) : (
          <div className="quiet-mode">
            <Sparkles size={24} />
            <h3>Stats hidden</h3>
            <p>The game is still using the same optimal model in the background.</p>
          </div>
        )}
      </aside>
    </main>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>('play');

  return (
    <div className="app">
      <header className="site-header">
        <button
          type="button"
          className="brand"
          onClick={() => setPage('play')}
          aria-label="Go to play page"
        >
          <span>QD</span>
          <div>
            <strong>Quick Dice</strong>
            <small>Optimal play lab</small>
          </div>
        </button>
        <nav aria-label="Primary navigation">
          <button
            type="button"
            className={page === 'play' ? 'active' : ''}
            onClick={() => setPage('play')}
          >
            <Play size={16} />
            Play
          </button>
          <button
            type="button"
            className={page === 'rules' ? 'active' : ''}
            onClick={() => setPage('rules')}
          >
            <BookOpen size={16} />
            Rules
          </button>
          <button
            type="button"
            className={page === 'how' ? 'active' : ''}
            onClick={() => setPage('how')}
          >
            <Brain size={16} />
            How It Works
          </button>
          <button
            type="button"
            className={page === 'simulation' ? 'active' : ''}
            onClick={() => setPage('simulation')}
          >
            <FlaskConical size={16} />
            Simulation
          </button>
        </nav>
      </header>

      {page === 'play' && <PlayPage />}
      {page === 'rules' && <RulesPage />}
      {page === 'how' && <HowItWorksPage />}
      {page === 'simulation' && <SimulationPage />}
    </div>
  );
}
