import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, Wallet, PieChart as PieIcon, Target, ClipboardList,
  Landmark, Settings, Plus, ArrowUpCircle, ArrowDownCircle, Search,
  X, Pencil, Trash2, ChevronLeft, ChevronRight, Menu, TrendingUp,
  TrendingDown, AlertTriangle, Sparkles, Check, Wallet2, Banknote,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";

/* ---------------------------------- helpers ---------------------------------- */

const BRL = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const toBR = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (iso) => iso.slice(0, 7);
const uid = () => Math.random().toString(36).slice(2, 10);

const INCOME_CATEGORIES = ["Salário", "Freelance", "Venda", "Comissão", "Pix recebido", "Transferência", "Outros"];
const EXPENSE_CATEGORIES = ["Alimentação", "Transporte", "Moradia", "Saúde", "Educação", "Lazer", "Compras", "Assinaturas", "Contas", "Cartão", "Dívidas", "Investimentos", "Outros"];
const INCOME_ACCOUNTS = ["Dinheiro", "Conta bancária", "Pix", "Carteira digital", "Outros"];
const EXPENSE_METHODS = ["Pix", "Dinheiro", "Débito", "Crédito", "Transferência", "Boleto", "Outros"];

const CATEGORY_COLORS = {
  "Alimentação": "#1E56A0", "Transporte": "#3E7CB1", "Moradia": "#0B2545",
  "Saúde": "#5B8FC7", "Educação": "#7FA8D9", "Lazer": "#9FC1E7",
  "Compras": "#2D4A73", "Assinaturas": "#6B8CAE", "Contas": "#4A6FA5",
  "Cartão": "#8DA9C4", "Dívidas": "#DC2626", "Investimentos": "#16A34A",
  "Outros": "#A9B7C6",
};
const catColor = (c) => CATEGORY_COLORS[c] || "#A9B7C6";

const PERIODS = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "ano", label: "Este ano" },
];

function periodStart(key) {
  const now = new Date();
  const d = new Date(now);
  switch (key) {
    case "7d": d.setDate(now.getDate() - 6); break;
    case "30d": d.setDate(now.getDate() - 29); break;
    case "mes": d.setDate(1); break;
    case "3m": d.setMonth(now.getMonth() - 2, 1); break;
    case "6m": d.setMonth(now.getMonth() - 5, 1); break;
    case "ano": d.setMonth(0, 1); break;
    default: d.setDate(now.getDate() - 29);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

const STORAGE_KEY = "financeflow:data:v1";

const SEED = {
  userName: "",
  onboarded: false,
  theme: "light",
  accounts: [
    { id: uid(), name: "Conta principal", type: "Conta bancária", balance: 0 },
    { id: uid(), name: "Carteira", type: "Dinheiro", balance: 0 },
  ],
  transactions: [],
  budgets: [],
  goals: [],
};

/* ------------------------------ small building blocks ------------------------------ */

function Card({ children, className = "" }) {
  return (
    <div className={`ff-card ${className}`}>{children}</div>
  );
}

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="ff-empty">
      <Icon size={28} strokeWidth={1.5} />
      <p className="ff-empty-title">{title}</p>
      {hint && <p className="ff-empty-hint">{hint}</p>}
    </div>
  );
}

function ProgressBar({ pct, tone = "normal" }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = tone === "danger" ? "#DC2626" : tone === "warn" ? "#B45309" : "#16A34A";
  return (
    <div className="ff-progress-track">
      <div className="ff-progress-fill" style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

function Toast({ message, show }) {
  return (
    <div className={`ff-toast ${show ? "ff-toast-show" : ""}`}>
      <Check size={16} strokeWidth={2.5} />
      <span>{message}</span>
    </div>
  );
}

/* ---------------------------------- main app ---------------------------------- */

export default function FinanceFlowApp() {
  const [data, setData] = useState(SEED);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState(null); // 'entrada' | 'saida' | null
  const [detailTx, setDetailTx] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "" });
  const [period, setPeriod] = useState("30d");

  // load (browser localStorage — data stays on this device/browser only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setData({ ...SEED, ...JSON.parse(raw) });
      }
    } catch (e) {
      /* first run, nothing stored */
    } finally {
      setLoaded(true);
    }
  }, []);

  // persist
  const persist = useCallback((next) => {
    setData(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("storage error", e);
    }
  }, []);

  const showToast = (message) => {
    setToast({ show: true, message });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast({ show: false, message: "" }), 2600);
  };

  const update = (fn) => {
    const next = fn(structuredCloneShallow(data));
    persist(next);
  };

  function structuredCloneShallow(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* ----------------------- derived data ----------------------- */

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    const thisMonth = todayISO().slice(0, 7);
    let monthIncome = 0, monthExpense = 0;
    for (const t of data.transactions) {
      if (t.type === "entrada") { income += t.amount; if (monthKey(t.date) === thisMonth) monthIncome += t.amount; }
      else { expense += t.amount; if (monthKey(t.date) === thisMonth) monthExpense += t.amount; }
    }
    return {
      balance: income - expense,
      income, expense,
      monthResult: monthIncome - monthExpense,
    };
  }, [data.transactions]);

  const periodTx = useMemo(() => {
    const start = periodStart(period);
    return data.transactions.filter((t) => new Date(t.date + "T00:00:00") >= start);
  }, [data.transactions, period]);

  const chartSeries = useMemo(() => {
    const byDay = {};
    for (const t of periodTx) {
      const key = t.date;
      if (!byDay[key]) byDay[key] = { date: key, entradas: 0, saidas: 0 };
      byDay[key][t.type === "entrada" ? "entradas" : "saidas"] += t.amount;
    }
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, label: toBR(d.date).slice(0, 5) }));
  }, [periodTx]);

  const categoryBreakdown = useMemo(() => {
    const map = {};
    for (const t of periodTx) {
      if (t.type !== "saida") continue;
      map[t.category] = (map[t.category] || 0) + t.amount;
    }
    const arr = Object.entries(map).map(([name, value]) => ({ name, value }));
    arr.sort((a, b) => b.value - a.value);
    return arr;
  }, [periodTx]);

  const totalExpensePeriod = categoryBreakdown.reduce((s, c) => s + c.value, 0);

  const monthlyEvolution = useMemo(() => {
    const map = {};
    for (const t of data.transactions) {
      const key = monthKey(t.date);
      if (!map[key]) map[key] = { month: key, entradas: 0, saidas: 0 };
      map[key][t.type === "entrada" ? "entradas" : "saidas"] += t.amount;
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [data.transactions]);

  const budgetStatus = useMemo(() => {
    const thisMonth = todayISO().slice(0, 7);
    return data.budgets.map((b) => {
      const spent = data.transactions
        .filter((t) => t.type === "saida" && t.category === b.category && monthKey(t.date) === thisMonth)
        .reduce((s, t) => s + t.amount, 0);
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      return { ...b, spent, pct };
    });
  }, [data.budgets, data.transactions]);

  const insights = useMemo(() => {
    const list = [];
    for (const b of budgetStatus) {
      if (b.pct >= 100) list.push({ icon: "🔴", text: `Sua categoria ${b.category} ultrapassou o orçamento de ${BRL(b.limit)}.` });
      else if (b.pct >= 80) list.push({ icon: "⚠️", text: `Você já gastou ${b.pct.toFixed(0)}% do seu limite de ${b.category}.` });
    }
    if (monthlyEvolution.length >= 2) {
      const last = monthlyEvolution[monthlyEvolution.length - 1];
      const prev = monthlyEvolution[monthlyEvolution.length - 2];
      if (prev.saidas > 0) {
        const diff = ((last.saidas - prev.saidas) / prev.saidas) * 100;
        if (diff >= 15) list.push({ icon: "⚠️", text: `Seus gastos aumentaram ${diff.toFixed(0)}% em relação ao mês passado.` });
        else if (diff <= -15) list.push({ icon: "💰", text: `Você reduziu seus gastos em ${Math.abs(diff).toFixed(0)}% em relação ao mês passado.` });
      }
    }
    if (list.length === 0) list.push({ icon: "✨", text: "Tudo em ordem por aqui. Continue registrando suas movimentações." });
    return list.slice(0, 4);
  }, [budgetStatus, monthlyEvolution]);

  /* ----------------------------- actions ----------------------------- */

  const addTransaction = (tx) => {
    update((d) => {
      d.transactions.unshift({ ...tx, id: uid(), createdAt: Date.now() });
      return d;
    });
    setAddOpen(false);
    setAddType(null);
    showToast("Movimentação adicionada com sucesso!");
  };

  const saveEdit = (tx) => {
    update((d) => {
      d.transactions = d.transactions.map((t) => (t.id === tx.id ? tx : t));
      return d;
    });
    setEditTx(null);
    setDetailTx(null);
    showToast("Movimentação atualizada.");
  };

  const deleteTransaction = (id) => {
    update((d) => {
      d.transactions = d.transactions.filter((t) => t.id !== id);
      return d;
    });
    setDetailTx(null);
    showToast("Movimentação excluída.");
  };

  const addBudget = (b) => update((d) => { d.budgets.push({ ...b, id: uid() }); return d; });
  const deleteBudget = (id) => update((d) => { d.budgets = d.budgets.filter((b) => b.id !== id); return d; });

  const addGoal = (g) => update((d) => { d.goals.push({ ...g, id: uid(), current: 0 }); return d; });
  const contributeGoal = (id, amount) => update((d) => {
    d.goals = d.goals.map((g) => g.id === id ? { ...g, current: Math.min(g.target, g.current + amount) } : g);
    return d;
  });
  const deleteGoal = (id) => update((d) => { d.goals = d.goals.filter((g) => g.id !== id); return d; });

  const addAccount = (a) => update((d) => { d.accounts.push({ ...a, id: uid() }); return d; });
  const deleteAccount = (id) => update((d) => { d.accounts = d.accounts.filter((a) => a.id !== id); return d; });

  const finishOnboarding = (name) => update((d) => { d.userName = name || "Você"; d.onboarded = true; return d; });

  if (!loaded) {
    return (
      <div className="ff-root ff-loading">
        <FontLoader />
        <div className="ff-spinner" />
      </div>
    );
  }

  if (!data.onboarded) {
    return (
      <div className="ff-root">
        <FontLoader />
        <Onboarding onDone={finishOnboarding} />
      </div>
    );
  }

  const NAV = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "movimentacoes", label: "Movimentações", icon: Wallet },
    { key: "relatorios", label: "Relatórios", icon: PieIcon },
    { key: "metas", label: "Metas", icon: Target },
    { key: "planejamento", label: "Planejamento", icon: ClipboardList },
    { key: "contas", label: "Contas", icon: Landmark },
    { key: "config", label: "Configurações", icon: Settings },
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  })();

  return (
    <div className="ff-root">
      <FontLoader />
      <StyleSheet />
      <Toast {...toast} />

      {/* Sidebar */}
      <aside className={`ff-sidebar ${sidebarOpen ? "ff-sidebar-open" : ""}`}>
        <div className="ff-brand">
          <div className="ff-brand-mark">FF</div>
          <span>Finance Flow</span>
        </div>
        <nav className="ff-nav">
          {NAV.map((n) => (
            <button
              key={n.key}
              className={`ff-nav-item ${page === n.key ? "ff-nav-active" : ""}`}
              onClick={() => { setPage(n.key); setSidebarOpen(false); }}
            >
              <n.icon size={18} strokeWidth={1.8} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="ff-nav-footer">
          <div className="ff-avatar">{(data.userName || "V").slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="ff-nav-footer-name">{data.userName || "Você"}</div>
            <div className="ff-nav-footer-sub">Conta pessoal</div>
          </div>
        </div>
      </aside>
      {sidebarOpen && <div className="ff-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="ff-main">
        <header className="ff-topbar">
          <button className="ff-icon-btn ff-only-mobile" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="ff-topbar-title">{NAV.find((n) => n.key === page)?.label}</div>
          <button className="ff-btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={16} strokeWidth={2.5} /> <span>Nova movimentação</span>
          </button>
        </header>

        <main className="ff-content">
          {page === "dashboard" && (
            <Dashboard
              greeting={greeting}
              userName={data.userName}
              totals={totals}
              period={period}
              setPeriod={setPeriod}
              chartSeries={chartSeries}
              categoryBreakdown={categoryBreakdown}
              totalExpensePeriod={totalExpensePeriod}
              transactions={data.transactions}
              goals={data.goals}
              insights={insights}
              onOpenDetail={setDetailTx}
            />
          )}

          {page === "movimentacoes" && (
            <Transactions
              transactions={data.transactions}
              onOpenDetail={setDetailTx}
            />
          )}

          {page === "relatorios" && (
            <Reports
              period={period}
              setPeriod={setPeriod}
              totals={totals}
              periodTx={periodTx}
              categoryBreakdown={categoryBreakdown}
              totalExpensePeriod={totalExpensePeriod}
              monthlyEvolution={monthlyEvolution}
            />
          )}

          {page === "metas" && (
            <Goals goals={data.goals} onAdd={addGoal} onContribute={contributeGoal} onDelete={deleteGoal} />
          )}

          {page === "planejamento" && (
            <Budgets budgetStatus={budgetStatus} onAdd={addBudget} onDelete={deleteBudget} />
          )}

          {page === "contas" && (
            <Accounts accounts={data.accounts} onAdd={addAccount} onDelete={deleteAccount} />
          )}

          {page === "config" && (
            <SettingsPage userName={data.userName} onSave={(name) => update((d) => { d.userName = name; return d; })} />
          )}
        </main>
      </div>

      {/* Add transaction flow */}
      {addOpen && !addType && (
        <Modal onClose={() => setAddOpen(false)} title="O que você deseja registrar?">
          <div className="ff-choice-grid">
            <button className="ff-choice ff-choice-income" onClick={() => setAddType("entrada")}>
              <ArrowUpCircle size={26} />
              <span>Entrada</span>
            </button>
            <button className="ff-choice ff-choice-expense" onClick={() => setAddType("saida")}>
              <ArrowDownCircle size={26} />
              <span>Saída</span>
            </button>
          </div>
        </Modal>
      )}
      {addOpen && addType && (
        <TransactionForm
          type={addType}
          accounts={data.accounts}
          onCancel={() => { setAddType(null); setAddOpen(false); }}
          onSubmit={addTransaction}
        />
      )}

      {/* Detail / edit */}
      {detailTx && !editTx && (
        <Modal onClose={() => setDetailTx(null)} title="Detalhes da movimentação">
          <TransactionDetail
            tx={detailTx}
            onEdit={() => setEditTx(detailTx)}
            onDelete={() => deleteTransaction(detailTx.id)}
          />
        </Modal>
      )}
      {editTx && (
        <TransactionForm
          type={editTx.type}
          accounts={data.accounts}
          initial={editTx}
          onCancel={() => setEditTx(null)}
          onSubmit={saveEdit}
        />
      )}
    </div>
  );
}

/* --------------------------------- onboarding --------------------------------- */

function Onboarding({ onDone }) {
  const [name, setName] = useState("");
  return (
    <div className="ff-onboard">
      <StyleSheet />
      <div className="ff-onboard-card">
        <div className="ff-brand-mark ff-brand-mark-lg">FF</div>
        <h1>Finance Flow</h1>
        <p>Registre suas entradas e saídas e entenda exatamente para onde seu dinheiro está indo.</p>
        <label className="ff-label">Como podemos te chamar?</label>
        <input
          className="ff-input"
          placeholder="Seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onDone(name.trim())}
          autoFocus
        />
        <button className="ff-btn-primary ff-w-full" disabled={!name.trim()} onClick={() => onDone(name.trim())}>
          Começar a organizar minhas finanças
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- dashboard ---------------------------------- */

function SummaryCard({ label, value, icon: Icon, tone }) {
  return (
    <Card className="ff-summary-card">
      <div className={`ff-summary-icon ff-tone-${tone}`}><Icon size={18} strokeWidth={2} /></div>
      <div>
        <div className="ff-summary-label">{label}</div>
        <div className={`ff-summary-value ${tone === "danger" ? "ff-neg" : tone === "success" ? "ff-pos" : ""}`}>{BRL(value)}</div>
      </div>
    </Card>
  );
}

function Dashboard({ greeting, userName, totals, period, setPeriod, chartSeries, categoryBreakdown, totalExpensePeriod, transactions, goals, insights, onOpenDetail }) {
  return (
    <div className="ff-stack">
      <div>
        <h1 className="ff-h1">{greeting}, {userName || "por aqui"} 👋</h1>
        <p className="ff-subtle">Veja como está sua vida financeira hoje.</p>
      </div>

      <div className="ff-grid-4">
        <SummaryCard label="Saldo atual" value={totals.balance} icon={Wallet2} tone={totals.balance >= 0 ? "success" : "danger"} />
        <SummaryCard label="Total de entradas" value={totals.income} icon={TrendingUp} tone="success" />
        <SummaryCard label="Total de saídas" value={totals.expense} icon={TrendingDown} tone="danger" />
        <SummaryCard label="Resultado do mês" value={totals.monthResult} icon={Banknote} tone={totals.monthResult >= 0 ? "success" : "danger"} />
      </div>

      <div className="ff-grid-2">
        <Card>
          <div className="ff-card-head">
            <h3>Entradas x Saídas</h3>
            <PeriodSelect period={period} setPeriod={setPeriod} />
          </div>
          {chartSeries.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Nenhuma movimentação no período" hint="Registre uma entrada ou saída para ver o gráfico." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartSeries}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7A90" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7A90" }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => BRL(v)} contentStyle={{ borderRadius: 10, border: "1px solid #E5E9F0", fontSize: 12 }} />
                <Area type="monotone" dataKey="entradas" stroke="#16A34A" fill="url(#gIn)" strokeWidth={2} />
                <Area type="monotone" dataKey="saidas" stroke="#DC2626" fill="url(#gOut)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <div className="ff-card-head"><h3>Gastos por categoria</h3></div>
          {categoryBreakdown.length === 0 ? (
            <EmptyState icon={PieIcon} title="Sem saídas registradas" hint="Suas categorias de gasto aparecerão aqui." />
          ) : (
            <div className="ff-donut-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={2}>
                    {categoryBreakdown.map((c, i) => <Cell key={i} fill={catColor(c.name)} stroke="none" />)}
                  </Pie>
                  <Tooltip formatter={(v) => BRL(v)} contentStyle={{ borderRadius: 10, border: "1px solid #E5E9F0", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="ff-legend">
                {categoryBreakdown.slice(0, 6).map((c) => (
                  <div key={c.name} className="ff-legend-row">
                    <span className="ff-legend-dot" style={{ background: catColor(c.name) }} />
                    <span className="ff-legend-name">{c.name}</span>
                    <span className="ff-legend-pct">{totalExpensePeriod ? Math.round((c.value / totalExpensePeriod) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="ff-grid-2">
        <Card>
          <div className="ff-card-head"><h3>Últimas movimentações</h3></div>
          {transactions.length === 0 ? (
            <EmptyState icon={Wallet} title="Nenhuma movimentação ainda" hint="Toque em “Nova movimentação” para começar." />
          ) : (
            <div className="ff-tx-list">
              {transactions.slice(0, 6).map((t) => <TxRow key={t.id} t={t} onClick={() => onOpenDetail(t)} />)}
            </div>
          )}
        </Card>

        <Card>
          <div className="ff-card-head"><h3><Sparkles size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} />Insights financeiros</h3></div>
          <div className="ff-insights">
            {insights.map((i, idx) => (
              <div key={idx} className="ff-insight-row">
                <span>{i.icon}</span>
                <span>{i.text}</span>
              </div>
            ))}
          </div>
          {goals.length > 0 && (
            <>
              <div className="ff-divider" />
              <div className="ff-card-head"><h3>Metas</h3></div>
              {goals.slice(0, 2).map((g) => (
                <div key={g.id} className="ff-mini-goal">
                  <div className="ff-mini-goal-top">
                    <span>{g.name}</span>
                    <span>{Math.round((g.current / g.target) * 100)}%</span>
                  </div>
                  <ProgressBar pct={(g.current / g.target) * 100} />
                </div>
              ))}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function PeriodSelect({ period, setPeriod }) {
  return (
    <select className="ff-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
      {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
    </select>
  );
}

function TxRow({ t, onClick }) {
  const isIncome = t.type === "entrada";
  return (
    <button className="ff-tx-row" onClick={onClick}>
      <div className={`ff-tx-icon ${isIncome ? "ff-tx-icon-in" : "ff-tx-icon-out"}`}>
        {isIncome ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
      </div>
      <div className="ff-tx-mid">
        <div className="ff-tx-desc">{t.description}</div>
        <div className="ff-tx-sub">{t.category} · {toBR(t.date)}</div>
      </div>
      <div className={`ff-tx-amount ${isIncome ? "ff-pos" : "ff-neg"}`}>
        {isIncome ? "+" : "-"} {BRL(t.amount)}
      </div>
    </button>
  );
}

/* --------------------------------- transactions page --------------------------------- */

function Transactions({ transactions, onOpenDetail }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("todos");
  const [category, setCategory] = useState("todas");

  const categories = useMemo(() => Array.from(new Set(transactions.map((t) => t.category))).sort(), [transactions]);

  const filtered = transactions.filter((t) => {
    if (type !== "todos" && t.type !== type) return false;
    if (category !== "todas" && t.category !== category) return false;
    if (search && !`${t.description} ${t.category} ${t.location || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="ff-stack">
      <div className="ff-filters">
        <div className="ff-search">
          <Search size={16} />
          <input placeholder="Pesquisar movimentação..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="ff-select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          <option value="entrada">Entradas</option>
          <option value="saida">Saídas</option>
        </select>
        <select className="ff-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="todas">Todas as categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={Search} title="Nada encontrado" hint="Ajuste os filtros ou registre uma nova movimentação." />
        ) : (
          <div className="ff-tx-list">
            {filtered.map((t) => <TxRow key={t.id} t={t} onClick={() => onOpenDetail(t)} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

/* --------------------------------- reports page --------------------------------- */

function Reports({ period, setPeriod, totals, periodTx, categoryBreakdown, totalExpensePeriod, monthlyEvolution }) {
  const periodIncome = periodTx.filter((t) => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
  const periodExpense = periodTx.filter((t) => t.type === "saida").reduce((s, t) => s + t.amount, 0);

  const byMethod = useMemo(() => {
    const map = {};
    for (const t of periodTx) {
      if (t.type !== "saida") continue;
      const m = t.paymentMethod || "Outros";
      map[m] = (map[m] || 0) + t.amount;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [periodTx]);

  const biggestExpenses = useMemo(
    () => [...periodTx].filter((t) => t.type === "saida").sort((a, b) => b.amount - a.amount).slice(0, 5),
    [periodTx]
  );

  return (
    <div className="ff-stack">
      <div className="ff-card-head"><h3 className="ff-h3">Resumo do período</h3><PeriodSelect period={period} setPeriod={setPeriod} /></div>

      <div className="ff-grid-4">
        <SummaryCard label="Entradas" value={periodIncome} icon={TrendingUp} tone="success" />
        <SummaryCard label="Saídas" value={periodExpense} icon={TrendingDown} tone="danger" />
        <SummaryCard label="Saldo" value={periodIncome - periodExpense} icon={Wallet2} tone={periodIncome - periodExpense >= 0 ? "success" : "danger"} />
        <SummaryCard label="Economia" value={Math.max(0, periodIncome - periodExpense)} icon={Banknote} tone="success" />
      </div>

      <div className="ff-grid-2">
        <Card>
          <div className="ff-card-head"><h3>Evolução mensal</h3></div>
          {monthlyEvolution.length === 0 ? <EmptyState icon={TrendingUp} title="Sem dados suficientes" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7A90" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7A90" }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => BRL(v)} contentStyle={{ borderRadius: 10, border: "1px solid #E5E9F0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="entradas" fill="#16A34A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <div className="ff-card-head"><h3>Formas de pagamento</h3></div>
          {byMethod.length === 0 ? <EmptyState icon={Wallet} title="Sem saídas no período" /> : (
            <div className="ff-tx-list">
              {byMethod.map((m) => (
                <div key={m.name} className="ff-method-row">
                  <span>{m.name}</span>
                  <div className="ff-method-bar-track"><div className="ff-method-bar-fill" style={{ width: `${(m.value / byMethod[0].value) * 100}%` }} /></div>
                  <span className="ff-neg">{BRL(m.value)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="ff-grid-2">
        <Card>
          <div className="ff-card-head"><h3>Gastos por categoria</h3></div>
          {categoryBreakdown.length === 0 ? <EmptyState icon={PieIcon} title="Sem saídas no período" /> : (
            <div className="ff-tx-list">
              {categoryBreakdown.map((c) => (
                <div key={c.name} className="ff-method-row">
                  <span className="ff-legend-dot" style={{ background: catColor(c.name) }} />
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <span className="ff-neg">{BRL(c.value)}</span>
                  <span className="ff-subtle" style={{ width: 40, textAlign: "right" }}>{totalExpensePeriod ? Math.round((c.value / totalExpensePeriod) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="ff-card-head"><h3>Maiores gastos</h3></div>
          {biggestExpenses.length === 0 ? <EmptyState icon={TrendingDown} title="Sem saídas no período" /> : (
            <div className="ff-tx-list">
              {biggestExpenses.map((t) => <TxRow key={t.id} t={t} onClick={() => {}} />)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* --------------------------------- goals page --------------------------------- */

function Goals({ goals, onAdd, onContribute, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ff-stack">
      <div className="ff-row-between">
        <p className="ff-subtle">Defina objetivos e acompanhe seu progresso até alcançá-los.</p>
        <button className="ff-btn-secondary" onClick={() => setOpen(true)}><Plus size={16} /> Nova meta</button>
      </div>

      {goals.length === 0 ? (
        <Card><EmptyState icon={Target} title="Nenhuma meta criada" hint="Crie uma meta para começar a guardar dinheiro com propósito." /></Card>
      ) : (
        <div className="ff-grid-2">
          {goals.map((g) => {
            const pct = g.target ? (g.current / g.target) * 100 : 0;
            return (
              <Card key={g.id}>
                <div className="ff-row-between">
                  <h3 className="ff-h3">{g.name}</h3>
                  <button className="ff-icon-btn" onClick={() => onDelete(g.id)}><Trash2 size={15} /></button>
                </div>
                <div className="ff-goal-values">
                  <span>{BRL(g.current)}</span>
                  <span className="ff-subtle"> de {BRL(g.target)}</span>
                </div>
                <ProgressBar pct={pct} />
                <div className="ff-row-between" style={{ marginTop: 8 }}>
                  <span className="ff-subtle">{pct.toFixed(1)}% concluído</span>
                  {g.date && <span className="ff-subtle">Meta: {g.date}</span>}
                </div>
                <button
                  className="ff-btn-secondary ff-w-full"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    const raw = window.prompt(`Adicionar quanto à meta "${g.name}"?`, "100");
                    const val = parseFloat((raw || "0").replace(",", "."));
                    if (val > 0) onContribute(g.id, val);
                  }}
                >
                  Adicionar dinheiro à meta
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {open && (
        <Modal onClose={() => setOpen(false)} title="Nova meta">
          <GoalForm onCancel={() => setOpen(false)} onSubmit={(g) => { onAdd(g); setOpen(false); }} />
        </Modal>
      )}
    </div>
  );
}

function GoalForm({ onCancel, onSubmit }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  return (
    <div className="ff-form">
      <label className="ff-label">Nome da meta</label>
      <input className="ff-input" placeholder="Ex: Comprar notebook" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="ff-label">Valor da meta</label>
      <input className="ff-input" type="number" placeholder="0,00" value={target} onChange={(e) => setTarget(e.target.value)} />
      <label className="ff-label">Data desejada (opcional)</label>
      <input className="ff-input" type="month" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="ff-form-actions">
        <button className="ff-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button
          className="ff-btn-primary"
          disabled={!name.trim() || !target}
          onClick={() => onSubmit({ name: name.trim(), target: parseFloat(target), date })}
        >
          Criar meta
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- budgets page --------------------------------- */

function Budgets({ budgetStatus, onAdd, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ff-stack">
      <div className="ff-row-between">
        <p className="ff-subtle">Defina limites mensais por categoria e receba alertas antes de estourar o orçamento.</p>
        <button className="ff-btn-secondary" onClick={() => setOpen(true)}><Plus size={16} /> Novo limite</button>
      </div>

      {budgetStatus.length === 0 ? (
        <Card><EmptyState icon={ClipboardList} title="Nenhum limite definido" hint="Crie limites para acompanhar seus gastos por categoria." /></Card>
      ) : (
        <div className="ff-grid-2">
          {budgetStatus.map((b) => {
            const tone = b.pct >= 100 ? "danger" : b.pct >= 80 ? "warn" : "normal";
            return (
              <Card key={b.id}>
                <div className="ff-row-between">
                  <h3 className="ff-h3">{b.category}</h3>
                  <button className="ff-icon-btn" onClick={() => onDelete(b.id)}><Trash2 size={15} /></button>
                </div>
                <div className="ff-goal-values">
                  <span>{BRL(b.spent)}</span>
                  <span className="ff-subtle"> de {BRL(b.limit)}</span>
                </div>
                <ProgressBar pct={b.pct} tone={tone} />
                {b.pct >= 80 && (
                  <div className={`ff-alert ${b.pct >= 100 ? "ff-alert-danger" : "ff-alert-warn"}`}>
                    <AlertTriangle size={14} />
                    {b.pct >= 100 ? "Limite ultrapassado." : `Você já usou ${b.pct.toFixed(0)}% do limite.`}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {open && (
        <Modal onClose={() => setOpen(false)} title="Novo limite mensal">
          <BudgetForm onCancel={() => setOpen(false)} onSubmit={(b) => { onAdd(b); setOpen(false); }} />
        </Modal>
      )}
    </div>
  );
}

function BudgetForm({ onCancel, onSubmit }) {
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [limit, setLimit] = useState("");
  return (
    <div className="ff-form">
      <label className="ff-label">Categoria</label>
      <select className="ff-input" value={category} onChange={(e) => setCategory(e.target.value)}>
        {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <label className="ff-label">Limite mensal</label>
      <input className="ff-input" type="number" placeholder="0,00" value={limit} onChange={(e) => setLimit(e.target.value)} />
      <div className="ff-form-actions">
        <button className="ff-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="ff-btn-primary" disabled={!limit} onClick={() => onSubmit({ category, limit: parseFloat(limit) })}>Salvar limite</button>
      </div>
    </div>
  );
}

/* --------------------------------- accounts page --------------------------------- */

function Accounts({ accounts, onAdd, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ff-stack">
      <div className="ff-row-between">
        <p className="ff-subtle">Organize onde seu dinheiro está guardado.</p>
        <button className="ff-btn-secondary" onClick={() => setOpen(true)}><Plus size={16} /> Nova conta</button>
      </div>

      <div className="ff-grid-3">
        {accounts.map((a) => (
          <Card key={a.id}>
            <div className="ff-row-between">
              <div className="ff-account-icon"><Landmark size={16} /></div>
              <button className="ff-icon-btn" onClick={() => onDelete(a.id)}><Trash2 size={15} /></button>
            </div>
            <h3 className="ff-h3" style={{ marginTop: 10 }}>{a.name}</h3>
            <p className="ff-subtle">{a.type}</p>
            <div className="ff-summary-value" style={{ marginTop: 6 }}>{BRL(a.balance)}</div>
          </Card>
        ))}
      </div>

      {open && (
        <Modal onClose={() => setOpen(false)} title="Nova conta">
          <AccountForm onCancel={() => setOpen(false)} onSubmit={(a) => { onAdd(a); setOpen(false); }} />
        </Modal>
      )}
    </div>
  );
}

function AccountForm({ onCancel, onSubmit }) {
  const [name, setName] = useState("");
  const [type, setType] = useState(INCOME_ACCOUNTS[0]);
  const [balance, setBalance] = useState("");
  return (
    <div className="ff-form">
      <label className="ff-label">Nome</label>
      <input className="ff-input" placeholder="Ex: Nubank" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="ff-label">Tipo</label>
      <select className="ff-input" value={type} onChange={(e) => setType(e.target.value)}>
        {INCOME_ACCOUNTS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <label className="ff-label">Saldo inicial</label>
      <input className="ff-input" type="number" placeholder="0,00" value={balance} onChange={(e) => setBalance(e.target.value)} />
      <div className="ff-form-actions">
        <button className="ff-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="ff-btn-primary" disabled={!name.trim()} onClick={() => onSubmit({ name: name.trim(), type, balance: parseFloat(balance) || 0 })}>Adicionar conta</button>
      </div>
    </div>
  );
}

/* --------------------------------- settings page --------------------------------- */

function SettingsPage({ userName, onSave }) {
  const [name, setName] = useState(userName || "");
  const [saved, setSaved] = useState(false);
  return (
    <Card className="ff-settings-card">
      <h3 className="ff-h3">Meu perfil</h3>
      <label className="ff-label">Nome</label>
      <input className="ff-input" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="ff-label">Moeda</label>
      <input className="ff-input" value="Real brasileiro (R$)" disabled />
      <button
        className="ff-btn-primary"
        style={{ marginTop: 14 }}
        onClick={() => { onSave(name); setSaved(true); window.setTimeout(() => setSaved(false), 2000); }}
      >
        {saved ? "Salvo!" : "Salvar alterações"}
      </button>
    </Card>
  );
}

/* --------------------------------- transaction form / detail --------------------------------- */

function TransactionForm({ type, accounts, initial, onCancel, onSubmit }) {
  const isIncome = type === "entrada";
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [description, setDescription] = useState(initial?.description || "");
  const [category, setCategory] = useState(initial?.category || categories[0]);
  const [date, setDate] = useState(initial?.date || todayISO());
  const [account, setAccount] = useState(initial?.account || (isIncome ? INCOME_ACCOUNTS[0] : EXPENSE_METHODS[0]));
  const [location, setLocation] = useState(initial?.location || "");
  const [notes, setNotes] = useState(initial?.notes || "");

  const valid = amount && parseFloat(amount) > 0 && description.trim();

  const submit = () => {
    const tx = {
      ...(initial || {}),
      type, amount: parseFloat(amount), description: description.trim(), category, date,
      [isIncome ? "account" : "paymentMethod"]: account,
      location: location.trim(), notes: notes.trim(),
    };
    onSubmit(tx);
  };

  return (
    <Modal onClose={onCancel} title={initial ? "Editar movimentação" : isIncome ? "Nova entrada" : "Nova saída"}>
      <div className="ff-form">
        <label className="ff-label">Valor</label>
        <div className="ff-currency-input">
          <span>R$</span>
          <input className="ff-input ff-input-no-border" type="number" step="0.01" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>

        <label className="ff-label">Descrição</label>
        <input className="ff-input" placeholder={isIncome ? "Ex: Salário de setembro" : "Ex: Compra no supermercado"} value={description} onChange={(e) => setDescription(e.target.value)} />

        <label className="ff-label">Categoria</label>
        <select className="ff-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <label className="ff-label">Data</label>
        <input className="ff-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <label className="ff-label">{isIncome ? "Conta / Carteira" : "Forma de pagamento"}</label>
        <select className="ff-input" value={account} onChange={(e) => setAccount(e.target.value)}>
          {(isIncome ? INCOME_ACCOUNTS : EXPENSE_METHODS).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        <label className="ff-label">{isIncome ? "Origem do dinheiro (opcional)" : "Onde foi gasto? (opcional)"}</label>
        <input className="ff-input" placeholder={isIncome ? "Ex: Empresa XPTO" : "Ex: Mercado São João"} value={location} onChange={(e) => setLocation(e.target.value)} />

        <label className="ff-label">Observação (opcional)</label>
        <textarea className="ff-input ff-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="ff-form-actions">
          <button className="ff-btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className={`ff-btn-primary ${isIncome ? "" : "ff-btn-danger"}`} disabled={!valid} onClick={submit}>
            {initial ? "Salvar alterações" : isIncome ? "Adicionar entrada" : "Registrar saída"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TransactionDetail({ tx, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const isIncome = tx.type === "entrada";
  const rows = [
    ["Valor", BRL(tx.amount)],
    ["Tipo", isIncome ? "Entrada" : "Saída"],
    ["Categoria", tx.category],
    ["Data", toBR(tx.date)],
    [isIncome ? "Conta / Carteira" : "Forma de pagamento", tx.account || tx.paymentMethod],
    [isIncome ? "Origem" : "Local", tx.location || "—"],
    ["Descrição", tx.description],
    ["Observação", tx.notes || "—"],
  ];
  return (
    <div className="ff-form">
      {rows.map(([k, v]) => (
        <div key={k} className="ff-detail-row">
          <span className="ff-subtle">{k}</span>
          <span className={k === "Valor" ? (isIncome ? "ff-pos" : "ff-neg") : ""}>{v}</span>
        </div>
      ))}
      {!confirming ? (
        <div className="ff-form-actions">
          <button className="ff-btn-ghost" onClick={() => setConfirming(true)}><Trash2 size={15} /> Excluir</button>
          <button className="ff-btn-primary" onClick={onEdit}><Pencil size={15} /> Editar</button>
        </div>
      ) : (
        <div className="ff-alert ff-alert-danger" style={{ marginTop: 12 }}>
          <span>Excluir esta movimentação? Essa ação não pode ser desfeita.</span>
          <div className="ff-form-actions" style={{ marginTop: 10 }}>
            <button className="ff-btn-ghost" onClick={() => setConfirming(false)}>Cancelar</button>
            <button className="ff-btn-danger ff-btn-primary" onClick={onDelete}>Confirmar exclusão</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- modal shell --------------------------------- */

function Modal({ title, children, onClose }) {
  return (
    <div className="ff-modal-overlay" onClick={onClose}>
      <div className="ff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ff-modal-head">
          <h3>{title}</h3>
          <button className="ff-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ff-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------- fonts + styles --------------------------------- */

function FontLoader() {
  return (
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');`}</style>
  );
}

function StyleSheet() {
  return (
    <style>{`
      .ff-root { font-family: 'Inter', -apple-system, sans-serif; color: #17253D; min-height: 100%; display: flex; background: #F5F7FA; }
      .ff-root * { box-sizing: border-box; }
      .ff-h1, .ff-h3, .ff-brand span, .ff-summary-value, .ff-onboard-card h1 { font-family: 'Sora', 'Inter', sans-serif; }

      .ff-loading { align-items: center; justify-content: center; }
      .ff-spinner { width: 34px; height: 34px; border-radius: 50%; border: 3px solid #DCE4EF; border-top-color: #1E56A0; animation: ffspin 0.8s linear infinite; }
      @keyframes ffspin { to { transform: rotate(360deg); } }

      /* Sidebar */
      .ff-sidebar { width: 240px; background: #0B2545; color: #E8EEF7; display: flex; flex-direction: column; padding: 20px 14px; flex-shrink: 0; position: sticky; top: 0; height: 100vh; }
      .ff-brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 22px; font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
      .ff-brand-mark { width: 32px; height: 32px; border-radius: 9px; background: linear-gradient(135deg, #1E56A0, #3E7CB1); display: flex; align-items: center; justify-content: center; font-family: 'Sora', sans-serif; font-weight: 700; font-size: 13px; }
      .ff-brand-mark-lg { width: 52px; height: 52px; font-size: 18px; border-radius: 14px; margin-bottom: 14px; }
      .ff-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
      .ff-nav-item { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 9px; background: transparent; border: none; color: #A9BBD6; font-size: 13.5px; font-weight: 500; cursor: pointer; text-align: left; transition: background .15s, color .15s; }
      .ff-nav-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
      .ff-nav-active { background: rgba(62,124,177,0.25); color: #fff; }
      .ff-nav-footer { display: flex; align-items: center; gap: 10px; padding: 12px 8px 4px; border-top: 1px solid rgba(255,255,255,0.08); margin-top: 10px; }
      .ff-avatar { width: 32px; height: 32px; border-radius: 50%; background: #3E7CB1; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
      .ff-nav-footer-name { font-size: 13px; font-weight: 600; }
      .ff-nav-footer-sub { font-size: 11px; color: #8CA0C2; }
      .ff-overlay { position: fixed; inset: 0; background: rgba(11,37,69,0.4); z-index: 30; }

      .ff-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .ff-topbar { display: flex; align-items: center; gap: 12px; padding: 16px 28px; background: #FFF; border-bottom: 1px solid #E5E9F0; position: sticky; top: 0; z-index: 10; }
      .ff-topbar-title { font-weight: 700; font-size: 15px; flex: 1; }
      .ff-only-mobile { display: none; }
      .ff-content { padding: 24px 28px 60px; flex: 1; }

      .ff-stack { display: flex; flex-direction: column; gap: 20px; }
      .ff-h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.01em; }
      .ff-h3 { font-size: 14.5px; font-weight: 700; margin: 0; }
      .ff-subtle { color: #6B7A90; font-size: 13px; margin: 0; }

      .ff-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
      .ff-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .ff-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

      .ff-card { background: #FFF; border-radius: 14px; border: 1px solid #E9EDF3; padding: 18px 20px; box-shadow: 0 1px 2px rgba(16,30,54,0.03); }
      .ff-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
      .ff-card-head h3 { margin: 0; font-size: 14.5px; font-weight: 700; }

      .ff-summary-card { display: flex; align-items: center; gap: 12px; }
      .ff-summary-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .ff-tone-success { background: #E7F6EC; color: #16A34A; }
      .ff-tone-danger { background: #FCEAEA; color: #DC2626; }
      .ff-tone-normal { background: #E9F0FA; color: #1E56A0; }
      .ff-summary-label { font-size: 12px; color: #6B7A90; margin-bottom: 2px; }
      .ff-summary-value { font-size: 19px; font-weight: 700; letter-spacing: -0.01em; }
      .ff-pos { color: #16A34A; } .ff-neg { color: #DC2626; }

      .ff-select { border: 1px solid #E1E7F0; border-radius: 8px; padding: 6px 10px; font-size: 12.5px; color: #37485F; background: #FBFCFE; font-family: inherit; }
      .ff-btn-primary { display: inline-flex; align-items: center; gap: 7px; background: #1E56A0; color: #fff; border: none; border-radius: 9px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background .15s; }
      .ff-btn-primary:hover { background: #17457F; }
      .ff-btn-primary:disabled { background: #B7C6DA; cursor: not-allowed; }
      .ff-btn-danger { background: #DC2626; } .ff-btn-danger:hover { background: #B91C1C; }
      .ff-btn-secondary { display: inline-flex; align-items: center; gap: 6px; background: #E9F0FA; color: #1E56A0; border: none; border-radius: 9px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
      .ff-btn-ghost { background: transparent; border: 1px solid #E1E7F0; color: #4B5A70; border-radius: 9px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
      .ff-icon-btn { background: transparent; border: none; cursor: pointer; color: #6B7A90; padding: 6px; border-radius: 7px; display: flex; }
      .ff-icon-btn:hover { background: #F0F3F8; color: #17253D; }
      .ff-w-full { width: 100%; justify-content: center; }

      .ff-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 34px 10px; color: #9AA8BC; }
      .ff-empty-title { font-size: 13.5px; font-weight: 600; color: #56637A; margin: 4px 0 0; }
      .ff-empty-hint { font-size: 12px; margin: 0; max-width: 240px; }

      .ff-tx-list { display: flex; flex-direction: column; }
      .ff-tx-row { display: flex; align-items: center; gap: 12px; padding: 10px 4px; border: none; background: transparent; width: 100%; text-align: left; cursor: pointer; border-radius: 9px; }
      .ff-tx-row:hover { background: #F6F8FB; }
      .ff-tx-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .ff-tx-icon-in { background: #E7F6EC; color: #16A34A; }
      .ff-tx-icon-out { background: #FCEAEA; color: #DC2626; }
      .ff-tx-mid { flex: 1; min-width: 0; }
      .ff-tx-desc { font-size: 13.5px; font-weight: 600; color: #17253D; }
      .ff-tx-sub { font-size: 12px; color: #8494A8; }
      .ff-tx-amount { font-size: 13.5px; font-weight: 700; white-space: nowrap; }

      .ff-donut-wrap { display: flex; align-items: center; gap: 10px; }
      .ff-legend { flex: 1; display: flex; flex-direction: column; gap: 8px; }
      .ff-legend-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
      .ff-legend-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
      .ff-legend-name { flex: 1; color: #37485F; }
      .ff-legend-pct { color: #8494A8; font-weight: 600; }

      .ff-insights { display: flex; flex-direction: column; gap: 10px; }
      .ff-insight-row { display: flex; gap: 9px; align-items: flex-start; font-size: 12.5px; color: #37485F; background: #F6F8FB; border-radius: 9px; padding: 9px 11px; }
      .ff-divider { height: 1px; background: #EDF0F5; margin: 14px 0; }
      .ff-mini-goal { margin-bottom: 10px; }
      .ff-mini-goal-top { display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 5px; color: #37485F; }

      .ff-progress-track { height: 7px; background: #EDF1F6; border-radius: 5px; overflow: hidden; }
      .ff-progress-fill { height: 100%; border-radius: 5px; transition: width .3s; }

      .ff-filters { display: flex; gap: 10px; flex-wrap: wrap; }
      .ff-search { display: flex; align-items: center; gap: 8px; background: #FFF; border: 1px solid #E1E7F0; border-radius: 9px; padding: 8px 12px; flex: 1; min-width: 200px; color: #8494A8; }
      .ff-search input { border: none; outline: none; flex: 1; font-size: 13px; font-family: inherit; color: #17253D; }

      .ff-choice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .ff-choice { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 26px 10px; border-radius: 12px; border: 1.5px solid #E1E7F0; background: #FBFCFE; cursor: pointer; font-weight: 600; font-size: 13.5px; transition: transform .1s, border-color .15s; }
      .ff-choice:hover { transform: translateY(-2px); }
      .ff-choice-income { color: #16A34A; } .ff-choice-income:hover { border-color: #16A34A; }
      .ff-choice-expense { color: #DC2626; } .ff-choice-expense:hover { border-color: #DC2626; }

      .ff-modal-overlay { position: fixed; inset: 0; background: rgba(11,20,37,0.45); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; }
      .ff-modal { background: #FFF; border-radius: 16px; width: 100%; max-width: 440px; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; }
      .ff-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 12px; border-bottom: 1px solid #F0F2F6; }
      .ff-modal-head h3 { margin: 0; font-size: 15px; font-weight: 700; font-family: 'Sora', sans-serif; }
      .ff-modal-body { padding: 18px 20px 22px; overflow-y: auto; }

      .ff-form { display: flex; flex-direction: column; gap: 4px; }
      .ff-label { font-size: 12px; font-weight: 600; color: #56637A; margin-top: 10px; margin-bottom: 5px; }
      .ff-input { border: 1px solid #E1E7F0; border-radius: 9px; padding: 10px 12px; font-size: 13.5px; font-family: inherit; color: #17253D; outline: none; background: #FBFCFE; }
      .ff-input:focus { border-color: #1E56A0; background: #fff; }
      .ff-textarea { min-height: 64px; resize: vertical; }
      .ff-currency-input { display: flex; align-items: center; gap: 6px; border: 1px solid #E1E7F0; border-radius: 9px; padding: 0 12px; background: #FBFCFE; }
      .ff-currency-input span { color: #6B7A90; font-size: 13.5px; font-weight: 600; }
      .ff-input-no-border { border: none; background: transparent; padding: 10px 0; flex: 1; }
      .ff-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

      .ff-detail-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #F2F4F8; font-size: 13px; }
      .ff-detail-row:last-of-type { border-bottom: none; }

      .ff-alert { display: flex; align-items: center; gap: 8px; border-radius: 9px; padding: 9px 12px; font-size: 12.5px; font-weight: 500; }
      .ff-alert-warn { background: #FEF3E2; color: #B45309; }
      .ff-alert-danger { background: #FCEAEA; color: #DC2626; }

      .ff-goal-values { font-size: 18px; font-weight: 700; margin: 8px 0 8px; font-family: 'Sora', sans-serif; }
      .ff-row-between { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .ff-account-icon { width: 34px; height: 34px; border-radius: 9px; background: #E9F0FA; color: #1E56A0; display: flex; align-items: center; justify-content: center; }

      .ff-method-row { display: flex; align-items: center; gap: 10px; padding: 8px 4px; font-size: 13px; }
      .ff-method-bar-track { flex: 1; height: 6px; background: #EDF1F6; border-radius: 4px; overflow: hidden; }
      .ff-method-bar-fill { height: 100%; background: #1E56A0; border-radius: 4px; }

      .ff-settings-card { max-width: 420px; }

      .ff-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px); background: #17253D; color: #fff; padding: 11px 18px; border-radius: 10px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px; opacity: 0; pointer-events: none; transition: all .25s; z-index: 60; }
      .ff-toast-show { opacity: 1; transform: translateX(-50%) translateY(0); }

      .ff-onboard { min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #0B2545, #1E56A0); padding: 20px; }
      .ff-onboard-card { background: #fff; border-radius: 18px; padding: 36px 32px; max-width: 380px; width: 100%; text-align: center; }
      .ff-onboard-card h1 { font-size: 22px; margin: 4px 0 8px; }
      .ff-onboard-card p { color: #6B7A90; font-size: 13.5px; margin: 0 0 20px; }
      .ff-onboard-card .ff-label { text-align: left; }
      .ff-onboard-card .ff-input { margin-bottom: 16px; }

      @media (max-width: 980px) {
        .ff-grid-4 { grid-template-columns: repeat(2, 1fr); }
        .ff-grid-3 { grid-template-columns: repeat(2, 1fr); }
        .ff-grid-2 { grid-template-columns: 1fr; }
      }
      @media (max-width: 720px) {
        .ff-sidebar { position: fixed; left: -260px; top: 0; z-index: 40; transition: left .2s; box-shadow: 4px 0 20px rgba(0,0,0,0.15); }
        .ff-sidebar-open { left: 0; }
        .ff-only-mobile { display: flex; }
        .ff-content { padding: 18px 14px 80px; }
        .ff-topbar { padding: 14px 16px; }
        .ff-grid-4 { grid-template-columns: 1fr 1fr; }
        .ff-btn-primary span { display: none; }
      }
    `}</style>
  );
}
