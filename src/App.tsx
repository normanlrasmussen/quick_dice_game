import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
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
  History,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  formatPercent,
  nextRollOutcomes,
  POLICY,
  resolvePlayerTwo,
  rollTwoDice,
  stateForTotal,
  type OutcomeOdds,
} from './gameMath';

type Page = 'play' | 'rules' | 'how';
type GamePhase = 'playing' | 'stood' | 'bust' | 'win';

type HistoryPoint = {
  rollNumber: number;
  total: number;
  optimalWinPercent: number;
};

type LastRoll = {
  dieOne: number;
  dieTwo: number;
  total: number;
} | null;

type PlayerTwoResult = ReturnType<typeof resolvePlayerTwo> | null;

const decisionText = {
  roll: 'Roll',
  stand: 'Stand',
  win: 'Already won',
  bust: 'Busted',
};

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

function DiceFace({ value }: { value: number | null }) {
  return <div className="die-face">{value ?? '-'}</div>;
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
  const decisionRows = Object.values(POLICY)
    .filter((state) => state.total <= 21)
    .sort((a, b) => a.total - b.total)
    .map((state) => ({
      total: state.total,
      optimalWin: Number((state.optimal.win * 100).toFixed(2)),
      decision: state.decision === 'stand' ? 1 : 0,
    }));

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
            model stores the chance of a win, tie, and loss.
          </p>
        </article>
        <article>
          <span>2</span>
          <h2>Lock the endpoints</h2>
          <p>
            Totals above 21 are losses. A total of 21 is a win. Those known
            outcomes give the calculation a firm starting point.
          </p>
        </article>
        <article>
          <span>3</span>
          <h2>Compare stand versus roll</h2>
          <p>
            Standing asks how Player 2 will finish. Rolling averages every
            possible two-dice sum and uses the already-computed future totals.
          </p>
        </article>
        <article>
          <span>4</span>
          <h2>Keep the better win chance</h2>
          <p>
            The optimal value is whichever action gives Player 1 the larger win
            probability. In this game, the win-max policy starts standing at 16.
          </p>
        </article>
      </div>

      <section className="chart-panel wide">
        <div className="section-title">
          <Target size={18} />
          <h2>Optimal win curve</h2>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={decisionRows} margin={{ left: 6, right: 12, top: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="optimalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2f6f68" stopOpacity={0.36} />
                <stop offset="95%" stopColor="#2f6f68" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e4ded1" strokeDasharray="4 4" />
            <XAxis dataKey="total" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              unit="%"
              domain={[0, 100]}
              width={42}
            />
            <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
            <Area
              type="monotone"
              dataKey="optimalWin"
              stroke="#2f6f68"
              fill="url(#optimalGradient)"
              strokeWidth={3}
              name="Optimal win"
            />
          </AreaChart>
        </ResponsiveContainer>
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

  const state = stateForTotal(total);
  const nextRollData = useMemo(() => nextRollOutcomes(total), [total]);
  const canRoll = phase === 'playing';
  const canStand = phase === 'playing' && total > 0 && total < 21;
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
  }

  function recordHistory(nextTotal: number) {
    const nextState = stateForTotal(nextTotal);
    setHistory((items) => [
      ...items,
      {
        rollNumber: items.length + 1,
        total: nextTotal,
        optimalWinPercent: Number((nextState.optimal.win * 100).toFixed(2)),
      },
    ]);
  }

  function handleRoll() {
    if (!canRoll) return;

    const roll = rollTwoDice();
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
  }

  function handleStand() {
    if (!canStand) return;

    const result = resolvePlayerTwo(total);
    setPlayerTwo(result);
    setPhase('stood');
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

        <div className="scoreboard">
          <div>
            <span>Total</span>
            <strong>{total}</strong>
          </div>
          <div>
            <span>Target</span>
            <strong>21</strong>
          </div>
          <div>
            <span>Optimal</span>
            <strong>{decisionText[state.decision]}</strong>
          </div>
        </div>

        <div className="dice-row" aria-label="Last dice roll">
          <DiceFace value={lastRoll?.dieOne ?? null} />
          <DiceFace value={lastRoll?.dieTwo ?? null} />
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
            <div className="stat-grid">
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
              <StatCard
                label="Stand win"
                value={formatPercent(state.stand.win)}
                detail="Let Player 2 chase"
              />
              <StatCard
                label="Roll win"
                value={formatPercent(state.roll.win)}
                detail="Expected future value"
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
                <h3>Win-percentage history</h3>
              </div>
              {history.length > 0 ? (
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={history} margin={{ left: 2, right: 10, top: 8, bottom: 0 }}>
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
                      labelFormatter={(label) => `Roll ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="optimalWinPercent"
                      stroke="#2f6f68"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#f7f3ea' }}
                      name="Optimal win"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-history">Roll once to start the trace.</div>
              )}
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
        </nav>
      </header>

      {page === 'play' && <PlayPage />}
      {page === 'rules' && <RulesPage />}
      {page === 'how' && <HowItWorksPage />}
    </div>
  );
}
