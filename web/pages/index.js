import { useEffect, useState, useRef } from "react";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const BUY_DATE = "2026-06-30";
const BUY_GRAMS = 5;

export default function Home() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const chartRef = useRef(null);
  const canvasRef = useRef(null);
  const drawerRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    fetch("/api/gold-rates")
      .then((r) => r.json())
      .then((data) => {
        setRates(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const buyRate = rates.find(
    (r) => r.date === BUY_DATE && r.brand === "Joyalukkas"
  );
  const buyRateValue = buyRate ? buyRate.rate : null;

  const latestJoyalukkas = [...rates]
    .reverse()
    .find((r) => r.brand === "Joyalukkas");

  function pctChange(brand, days) {
    const sorted = [...rates]
      .filter((r) => r.brand === brand)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) return null;
    const latest = sorted[sorted.length - 1];
    const latestDate = new Date(latest.date);
    const targetDate = new Date(latestDate);
    targetDate.setDate(targetDate.getDate() - days);
    const target = sorted
      .filter((r) => new Date(r.date) <= targetDate)
      .pop();
    if (!target || target.rate === 0) return null;
    return ((latest.rate - target.rate) / target.rate) * 100;
  }

  const currentRate = latestJoyalukkas?.rate || 0;
  const profitPerGram = buyRateValue ? currentRate - buyRateValue : 0;
  const totalProfit = profitPerGram * BUY_GRAMS;
  const currentValue5g = currentRate * BUY_GRAMS;
  const buyValue5g = buyRateValue ? buyRateValue * BUY_GRAMS : 0;

  const j7 = pctChange("Joyalukkas", 7);
  const j30 = pctChange("Joyalukkas", 30);

  const sortedJoyalukkas = [...rates]
    .filter((r) => r.brand === "Joyalukkas")
    .sort((a, b) => a.date.localeCompare(b.date));

  const allTimeHigh =
    sortedJoyalukkas.length > 0
      ? Math.max(...sortedJoyalukkas.map((r) => r.rate))
      : null;
  const allTimeLow =
    sortedJoyalukkas.length > 0
      ? Math.min(...sortedJoyalukkas.map((r) => r.rate))
      : null;

  useEffect(() => {
    if (rates.length === 0 || !canvasRef.current) return;

    if (chartRef.current) chartRef.current.destroy();

    const allDates = [...new Set(rates.map((r) => r.date))].sort();

    let filteredDates = allDates;
    if (timeRange !== "all") {
      const days =
        timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 180;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      filteredDates = allDates.filter((d) => new Date(d) >= cutoff);
    }

    const joyalukkasData = filteredDates.map((d) => {
      const r = rates.find((r) => r.date === d && r.brand === "Joyalukkas");
      return r ? r.rate : null;
    });

    const ctx = canvasRef.current.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, 350);
    gradient.addColorStop(0, "rgba(37, 99, 235, 0.25)");
    gradient.addColorStop(0.5, "rgba(37, 99, 235, 0.08)");
    gradient.addColorStop(1, "rgba(37, 99, 235, 0)");

    const buyLine =
      buyRateValue && filteredDates.includes(BUY_DATE)
        ? filteredDates.map((d) => (d === BUY_DATE ? buyRateValue : null))
        : null;

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: filteredDates,
        datasets: [
          ...(buyLine
            ? [
                {
                  label: `Buy Price (${BUY_DATE})`,
                  data: buyLine,
                  borderColor: "#22c55e",
                  backgroundColor: "transparent",
                  borderDash: [6, 4],
                  borderWidth: 2,
                  pointRadius: 8,
                  pointBackgroundColor: "#22c55e",
                  pointBorderColor: "#fff",
                  pointBorderWidth: 2,
                  pointHoverRadius: 10,
                  spanGaps: false,
                },
              ]
            : []),
          {
            label: "Joyalukkas 24KT (per gm)",
            data: joyalukkasData,
            borderColor: "#2563eb",
            backgroundColor: gradient,
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 7,
            pointBackgroundColor: "#2563eb",
            pointBorderColor: "#1e293b",
            pointBorderWidth: 2,
            pointHoverBackgroundColor: "#60a5fa",
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 2,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "index",
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              usePointStyle: true,
              padding: 16,
              color: "#94a3b8",
              font: { size: 12 },
            },
          },
          tooltip: {
            backgroundColor: "#1e293b",
            titleColor: "#f1f5f9",
            bodyColor: "#e2e8f0",
            borderColor: "#334155",
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              title: (items) => {
                if (items.length > 0) {
                  const date = new Date(items[0].label);
                  return date.toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                }
                return "";
              },
              label: (ctx) => {
                if (ctx.raw === null) return null;
                return ` ${ctx.dataset.label}: ₹${Number(ctx.raw).toLocaleString("en-IN")}`;
              },
              afterBody: (items) => {
                const joyItem = items.find(
                  (i) => i.datasetIndex === (buyLine ? 1 : 0)
                );
                if (
                  buyRateValue &&
                  joyItem &&
                  joyItem.raw &&
                  filteredDates.includes(BUY_DATE)
                ) {
                  const diff = joyItem.raw - buyRateValue;
                  const pct = ((diff / buyRateValue) * 100).toFixed(1);
                  return `\nvs Buy Price: ${diff >= 0 ? "+" : ""}₹${diff.toLocaleString("en-IN")} (${diff >= 0 ? "+" : ""}${pct}%)`;
                }
                return "";
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              color: "rgba(148, 163, 184, 0.06)",
              drawBorder: false,
            },
            ticks: {
              color: "#64748b",
              maxRotation: 45,
              font: { size: 11 },
              callback: (val, idx) => {
                const d = filteredDates[idx];
                if (!d) return "";
                const date = new Date(d);
                return date.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                });
              },
            },
          },
          y: {
            grid: {
              color: "rgba(148, 163, 184, 0.08)",
              drawBorder: false,
            },
            ticks: {
              color: "#64748b",
              font: { size: 11 },
              callback: (v) => `₹${v.toLocaleString("en-IN")}`,
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [rates, timeRange]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    if (menuOpen) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const rangeOptions = [
    ["7d", "7D"],
    ["30d", "30D"],
    ["90d", "90D"],
    ["180d", "6M"],
    ["all", "All"],
  ];

  const navLinks = [
    { label: "Dashboard", href: "#dashboard", action: () => { setMenuOpen(false); } },
    { label: "Rate History", href: "#chart", action: () => { setMenuOpen(false); document.getElementById("chart")?.scrollIntoView({ behavior: "smooth" }); } },
    { label: "P&L Summary", href: "#pnl", action: () => { setMenuOpen(false); document.getElementById("pnl")?.scrollIntoView({ behavior: "smooth" }); } },
  ];

  if (loading)
    return (
      <div className="container">
        <p className="loading">Loading gold rates...</p>
        <style jsx>{`
          .container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #0f172a;
            color: #94a3b8;
            font-family: system-ui, sans-serif;
          }
          .loading {
            font-size: 1.25rem;
          }
        `}</style>
      </div>
    );

  if (error)
    return (
      <div className="container">
        <p className="error">Error: {error}</p>
        <style jsx>{`
          .container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #0f172a;
            color: #94a3b8;
            font-family: system-ui, sans-serif;
          }
          .error {
            color: #ef4444;
            font-size: 1.25rem;
          }
        `}</style>
      </div>
    );

  return (
    <div className="page">
      <header className="header">
        <div className="header-row">
          <div className="header-left">
            <button
              className="hamburger"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <span className={`bar ${menuOpen ? "open" : ""}`} />
              <span className={`bar ${menuOpen ? "open" : ""}`} />
              <span className={`bar ${menuOpen ? "open" : ""}`} />
            </button>
            <div>
              <h1>Gold Price Tracker</h1>
              <p className="subtitle">Joyalukkas 24KT daily rates</p>
            </div>
          </div>
          <div className="header-right">
            <span className="badge">
              {latestJoyalukkas
                ? `₹${Number(latestJoyalukkas.rate).toLocaleString("en-IN")}`
                : "—"}
            </span>
          </div>
        </div>
      </header>

      <div
        className={`drawer-overlay ${menuOpen ? "visible" : ""}`}
        ref={overlayRef}
        onClick={() => setMenuOpen(false)}
      />
      <nav className={`drawer ${menuOpen ? "open" : ""}`} ref={drawerRef}>
        <div className="drawer-header">
          <span className="drawer-title">Menu</span>
          <button className="drawer-close" onClick={() => setMenuOpen(false)}>
            ✕
          </button>
        </div>
        <ul className="drawer-links">
          {navLinks.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  link.action();
                }}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="drawer-footer">
          <span>Joyalukkas 24KT</span>
        </div>
      </nav>

      <main className="main" id="dashboard">
        <div className="cards">
          <div className="card joyalukkas">
            <span className="label">Current Rate (per gm)</span>
            <span className="value">
              ₹
              {latestJoyalukkas
                ? Number(latestJoyalukkas.rate).toLocaleString("en-IN")
                : "—"}
              {j7 !== null && (
                <span className={`pct ${j7 >= 0 ? "up" : "down"}`}>
                  {j7 >= 0 ? "+" : ""}
                  {j7.toFixed(1)}%
                </span>
              )}
            </span>
            <span className="meta">
              {latestJoyalukkas?.date || "No data"}
              {j30 !== null && (
                <span>
                  {" "}
                  &middot; 30d: {j30 >= 0 ? "+" : ""}
                  {j30.toFixed(1)}%
                </span>
              )}
            </span>
          </div>

          <div className="card range">
            <span className="label">All-Time Range</span>
            <span className="value range-value">
              {allTimeLow ? `₹${allTimeLow.toLocaleString("en-IN")}` : "—"}
              <span className="range-sep">→</span>
              {allTimeHigh
                ? `₹${allTimeHigh.toLocaleString("en-IN")}`
                : "—"}
            </span>
            <span className="meta">
              {sortedJoyalukkas.length} data points &middot;{" "}
              {sortedJoyalukkas.length > 0
                ? sortedJoyalukkas[0].date
                : ""}{" "}
              to{" "}
              {sortedJoyalukkas.length > 0
                ? sortedJoyalukkas[sortedJoyalukkas.length - 1].date
                : ""}
            </span>
          </div>

          <div className={`card profit ${totalProfit >= 0 ? "up" : "down"}`} id="pnl">
            <span className="label">P&amp;L on 5g bought Jun 30</span>
            <span className="value">
              {totalProfit >= 0 ? "+" : ""}₹
              {totalProfit.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="meta">
              Buy: ₹
              {buyValue5g.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}{" "}
              &middot; Now: ₹
              {currentValue5g.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        <div className="chart-wrapper" id="chart">
          <div className="chart-header">
            <h2>Rate History</h2>
            <div className="range-buttons">
              {rangeOptions.map(([val, label]) => (
                <button
                  key={val}
                  className={`range-btn ${timeRange === val ? "active" : ""}`}
                  onClick={() => setTimeRange(val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {rates.length === 0 ? (
            <p className="no-data">No rate data yet. Run the scraper first.</p>
          ) : (
            <div className="chart-container">
              <canvas ref={canvasRef} />
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #0f172a;
          color: #e2e8f0;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(15, 23, 42, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid #1e293b;
          padding: 0.75rem 1rem;
        }
        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 960px;
          margin: 0 auto;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .header-left h1 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0;
        }
        .subtitle {
          color: #64748b;
          margin: 0;
          font-size: 0.75rem;
        }
        .header-right {
          display: flex;
          align-items: center;
        }
        .badge {
          background: #1e293b;
          border: 1px solid #334155;
          color: #f1f5f9;
          font-size: 0.9rem;
          font-weight: 600;
          padding: 0.35rem 0.75rem;
          border-radius: 8px;
        }

        .hamburger {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
          margin: -0.5rem;
          z-index: 110;
        }
        .bar {
          display: block;
          width: 20px;
          height: 2px;
          background: #e2e8f0;
          margin: 4px 0;
          border-radius: 2px;
          transition: all 0.3s ease;
        }
        .bar.open:nth-child(1) {
          transform: rotate(45deg) translate(4px, 4px);
        }
        .bar.open:nth-child(2) {
          opacity: 0;
        }
        .bar.open:nth-child(3) {
          transform: rotate(-45deg) translate(4px, -4px);
        }

        .drawer-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 200;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .drawer-overlay.visible {
          opacity: 1;
        }
        .drawer {
          display: none;
        }

        .main {
          max-width: 960px;
          margin: 0 auto;
          padding: 1.5rem 1rem;
        }
        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
        }
        .card.joyalukkas {
          border-left: 4px solid #2563eb;
        }
        .card.range {
          border-left: 4px solid #8b5cf6;
        }
        .card.profit {
          border-left: 4px solid #64748b;
        }
        .card.profit.up {
          border-left-color: #22c55e;
        }
        .card.profit.down {
          border-left-color: #ef4444;
        }
        .label {
          font-size: 0.8rem;
          color: #94a3b8;
          margin-bottom: 0.25rem;
        }
        .value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f1f5f9;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .range-value {
          font-size: 1rem;
          gap: 0.4rem;
        }
        .range-sep {
          color: #64748b;
          font-size: 0.9rem;
        }
        .card.profit.up .value {
          color: #22c55e;
        }
        .card.profit.down .value {
          color: #ef4444;
        }
        .pct {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.15rem 0.4rem;
          border-radius: 6px;
        }
        .pct.up {
          color: #22c55e;
          background: rgba(34, 197, 94, 0.1);
        }
        .pct.down {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }
        .meta {
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 0.25rem;
        }
        .chart-wrapper {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 1.25rem;
        }
        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          gap: 0.75rem;
        }
        .chart-header h2 {
          font-size: 1rem;
          margin: 0;
          color: #e2e8f0;
          white-space: nowrap;
        }
        .range-buttons {
          display: flex;
          gap: 0.3rem;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding: 0.1rem;
        }
        .range-buttons::-webkit-scrollbar {
          display: none;
        }
        .range-btn {
          background: transparent;
          border: 1px solid #334155;
          color: #94a3b8;
          padding: 0.35rem 0.65rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          flex-shrink: 0;
          min-height: 32px;
        }
        .range-btn:hover {
          border-color: #2563eb;
          color: #e2e8f0;
        }
        .range-btn.active {
          background: #2563eb;
          border-color: #2563eb;
          color: #fff;
        }
        .chart-container {
          position: relative;
          height: 300px;
        }
        .no-data {
          text-align: center;
          color: #64748b;
          padding: 3rem 0;
        }

        @media (max-width: 640px) {
          .page {
            padding: 0;
          }
          .hamburger {
            display: block;
          }
          .header-left h1 {
            font-size: 1.1rem;
          }
          .header-right .badge {
            font-size: 0.8rem;
            padding: 0.25rem 0.5rem;
          }
          .drawer-overlay {
            display: block;
            pointer-events: none;
          }
          .drawer-overlay.visible {
            pointer-events: auto;
          }
          .drawer {
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0;
            left: 0;
            width: 280px;
            height: 100vh;
            height: 100dvh;
            background: #0f172a;
            border-right: 1px solid #1e293b;
            z-index: 210;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .drawer.open {
            transform: translateX(0);
          }
          .drawer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid #1e293b;
          }
          .drawer-title {
            font-size: 1rem;
            font-weight: 600;
            color: #f1f5f9;
          }
          .drawer-close {
            background: none;
            border: none;
            color: #94a3b8;
            font-size: 1.25rem;
            cursor: pointer;
            padding: 0.25rem;
          }
          .drawer-links {
            list-style: none;
            padding: 0.5rem 0;
            margin: 0;
          }
          .drawer-links li a {
            display: block;
            padding: 0.85rem 1rem;
            color: #e2e8f0;
            text-decoration: none;
            font-size: 0.95rem;
            transition: background 0.15s;
          }
          .drawer-links li a:hover {
            background: #1e293b;
          }
          .drawer-footer {
            margin-top: auto;
            padding: 1rem;
            border-top: 1px solid #1e293b;
            color: #64748b;
            font-size: 0.75rem;
          }
          .main {
            padding: 1rem 0.75rem;
          }
          .cards {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
          .card {
            padding: 1rem;
          }
          .value {
            font-size: 1.35rem;
          }
          .range-value {
            font-size: 0.9rem;
          }
          .chart-wrapper {
            padding: 1rem 0.75rem;
            border-radius: 10px;
          }
          .chart-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
          .range-buttons {
            width: 100%;
            gap: 0.25rem;
          }
          .range-btn {
            padding: 0.4rem 0.75rem;
            font-size: 0.8rem;
          }
          .chart-container {
            height: 250px;
            margin: 0 -0.25rem;
          }
        }

        @media (min-width: 641px) and (max-width: 900px) {
          .cards {
            grid-template-columns: repeat(2, 1fr);
          }
          .card:last-child {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </div>
  );
}
