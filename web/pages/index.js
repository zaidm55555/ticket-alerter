import { useEffect, useState, useRef } from "react";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const BUY_DATE = "2026-06-30";
const BUY_GRAMS = 5;

export default function Home() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const chartRef = useRef(null);
  const canvasRef = useRef(null);

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
  const latestTanishq = [...rates]
    .reverse()
    .find((r) => r.brand === "Tanishq");

  const profitPerGram = buyRateValue
    ? (latestJoyalukkas?.rate || 0) / 10 - buyRateValue / 10
    : 0;
  const totalProfit = profitPerGram * BUY_GRAMS;
  const currentValue5g = latestJoyalukkas
    ? (latestJoyalukkas.rate / 10) * BUY_GRAMS
    : 0;
  const buyValue5g = buyRateValue ? (buyRateValue / 10) * BUY_GRAMS : 0;

  useEffect(() => {
    if (rates.length === 0 || !canvasRef.current) return;

    if (chartRef.current) chartRef.current.destroy();

    const labels = [...new Set(rates.map((r) => r.date))].sort();

    const tanishqData = labels.map((d) => {
      const r = rates.find((r) => r.date === d && r.brand === "Tanishq");
      return r ? r.rate : null;
    });
    const joyalukkasData = labels.map((d) => {
      const r = rates.find((r) => r.date === d && r.brand === "Joyalukkas");
      return r ? r.rate : null;
    });

    const ctx = canvasRef.current.getContext("2d");
    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Tanishq (1g Coin)",
            data: tanishqData,
            borderColor: "#d97706",
            backgroundColor: "rgba(217, 119, 6, 0.1)",
            tension: 0.3,
            pointRadius: 4,
            spanGaps: false,
          },
          {
            label: "Joyalukkas 24KT (per 10gm)",
            data: joyalukkasData,
            borderColor: "#2563eb",
            backgroundColor: "rgba(37, 99, 235, 0.1)",
            tension: 0.3,
            pointRadius: 4,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, padding: 20 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `₹${Number(ctx.raw).toLocaleString()}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            ticks: { callback: (v) => `₹${v.toLocaleString()}` },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [rates]);

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
        <h1>Gold Price Tracker</h1>
        <p className="subtitle">
          Tracked via Tanishq &amp; Joyalukkas daily scrapes
        </p>
      </header>

      <main className="main">
        <div className="cards">
          <div className="card tanishq">
            <span className="label">Tanishq 1g Coin</span>
            <span className="value">
              ₹
              {latestTanishq
                ? Number(latestTanishq.rate).toLocaleString()
                : "—"}
            </span>
            <span className="meta">
              {latestTanishq?.date || "No data"}
            </span>
          </div>

          <div className="card joyalukkas">
            <span className="label">Joyalukkas 24KT (per 10gm)</span>
            <span className="value">
              ₹
              {latestJoyalukkas
                ? Number(latestJoyalukkas.rate).toLocaleString()
                : "—"}
            </span>
            <span className="meta">
              {latestJoyalukkas?.date || "No data"}
            </span>
          </div>

          <div className={`card profit ${totalProfit >= 0 ? "up" : "down"}`}>
            <span className="label">P&amp;L on 5g bought Jun 30</span>
            <span className="value">
              {totalProfit >= 0 ? "+" : ""}₹{totalProfit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>
            <span className="meta">
              Buy: ₹{buyValue5g.toLocaleString("en-IN", { maximumFractionDigits: 2 })} &middot; Now: ₹
              {currentValue5g.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="chart-wrapper">
          <h2>Rate History</h2>
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
          padding: 2rem 1rem;
        }
        .header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .header h1 {
          font-size: 2rem;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0;
        }
        .subtitle {
          color: #64748b;
          margin: 0.5rem 0 0;
          font-size: 0.9rem;
        }
        .main {
          max-width: 960px;
          margin: 0 auto;
        }
        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
        }
        .card.tanishq {
          border-left: 4px solid #d97706;
        }
        .card.joyalukkas {
          border-left: 4px solid #2563eb;
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
          font-size: 0.85rem;
          color: #94a3b8;
          margin-bottom: 0.25rem;
        }
        .value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #f1f5f9;
        }
        .card.profit.up .value {
          color: #22c55e;
        }
        .card.profit.down .value {
          color: #ef4444;
        }
        .meta {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 0.25rem;
        }
        .chart-wrapper {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 1.5rem;
        }
        .chart-wrapper h2 {
          font-size: 1.1rem;
          margin: 0 0 1rem;
          color: #e2e8f0;
        }
        .chart-container {
          position: relative;
          height: 350px;
        }
        .no-data {
          text-align: center;
          color: #64748b;
          padding: 3rem 0;
        }
      `}</style>
    </div>
  );
}
