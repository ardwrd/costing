"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClayBadge,
  ClayButton,
  ClayCard,
  ClayInput,
  ClaySelect,
} from "@/components/ui/clay";
import { clamp, toNumber } from "@/lib/utils";

type CostKind = "variable" | "fixed";

type CostItem = {
  id: string;
  name: string;
  amount: number;
  kind: CostKind;
};

type Currency = "IDR" | "USD" | "SGD" | "MYR" | "EUR";

const STORAGE_KEY = "costing:mvp:v1";

const defaultItems: CostItem[] = [
  { id: "material", name: "Material / supplies", amount: 2500000, kind: "variable" },
  { id: "labor", name: "Direct labor", amount: 750000, kind: "variable" },
  { id: "packaging", name: "Packaging", amount: 350000, kind: "variable" },
  { id: "overhead", name: "Rent / overhead", amount: 500000, kind: "fixed" },
];

const currencyLocale: Record<Currency, string> = {
  IDR: "id-ID",
  USD: "en-US",
  SGD: "en-SG",
  MYR: "ms-MY",
  EUR: "de-DE",
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function money(value: number, currency: Currency) {
  return new Intl.NumberFormat(currencyLocale[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function Home() {
  const [items, setItems] = useState<CostItem[]>(defaultItems);
  const [quantity, setQuantity] = useState(1000);
  const [unit, setUnit] = useState("pcs");
  const [sellingPrice, setSellingPrice] = useState(6500);
  const [targetMargin, setTargetMargin] = useState(30);
  const [currency, setCurrency] = useState<Currency>("IDR");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.items)) setItems(data.items);
        if (typeof data.quantity === "number") setQuantity(data.quantity);
        if (typeof data.unit === "string") setUnit(data.unit);
        if (typeof data.sellingPrice === "number") setSellingPrice(data.sellingPrice);
        if (typeof data.targetMargin === "number") setTargetMargin(data.targetMargin);
        if (["IDR", "USD", "SGD", "MYR", "EUR"].includes(data.currency)) {
          setCurrency(data.currency);
        }
      }
    } catch {
      // Ignore malformed local data and keep safe defaults.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ items, quantity, unit, sellingPrice, targetMargin, currency }),
    );
  }, [hydrated, items, quantity, unit, sellingPrice, targetMargin, currency]);

  const metrics = useMemo(() => {
    const safeQuantity = Math.max(quantity, 1);
    const variableCost = items
      .filter((item) => item.kind === "variable")
      .reduce((sum, item) => sum + Math.max(item.amount, 0), 0);
    const fixedCost = items
      .filter((item) => item.kind === "fixed")
      .reduce((sum, item) => sum + Math.max(item.amount, 0), 0);
    const totalCost = variableCost + fixedCost;
    const totalCostPerUnit = totalCost / safeQuantity;
    const variableCostPerUnit = variableCost / safeQuantity;
    const suggestedPrice =
      targetMargin >= 100
        ? 0
        : totalCostPerUnit / Math.max(1 - targetMargin / 100, 0.01);
    const revenue = sellingPrice * safeQuantity;
    const profit = revenue - totalCost;
    const actualMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const markup = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const contribution = sellingPrice - variableCostPerUnit;
    const breakEvenUnits =
      fixedCost > 0 && contribution > 0 ? Math.ceil(fixedCost / contribution) : 0;

    return {
      variableCost,
      fixedCost,
      totalCost,
      totalCostPerUnit,
      variableCostPerUnit,
      suggestedPrice,
      revenue,
      profit,
      actualMargin,
      markup,
      contribution,
      breakEvenUnits,
    };
  }, [items, quantity, sellingPrice, targetMargin]);

  function updateItem(id: string, patch: Partial<CostItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function addItem() {
    setItems((current) => [
      ...current,
      { id: uid(), name: "New cost", amount: 0, kind: "variable" },
    ]);
  }

  function reset() {
    setItems(defaultItems);
    setQuantity(1000);
    setUnit("pcs");
    setSellingPrice(6500);
    setTargetMargin(30);
    setCurrency("IDR");
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Costing home">
          <span className="brand-mark">C</span>
          <span>
            <strong>Costing</strong>
            <small>by Astakula</small>
          </span>
        </a>

        <div className="topbar-actions">
          <ClaySelect
            aria-label="Currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
          >
            <option value="IDR">IDR</option>
            <option value="USD">USD</option>
            <option value="SGD">SGD</option>
            <option value="MYR">MYR</option>
            <option value="EUR">EUR</option>
          </ClaySelect>
          <ClayButton variant="quiet" onClick={reset}>
            Reset
          </ClayButton>
        </div>
      </header>

      <section className="hero">
        <ClayBadge>Generic costing calculator</ClayBadge>
        <h1>
          Know what it costs.
          <br />
          <span>Price it right.</span>
        </h1>
        <p>
          Calculate cost, unit economics, margin, markup, profit, and break-even
          for products, services, projects, or any custom business model.
        </p>
      </section>

      <section className="workspace">
        <div className="workspace-main">
          <ClayCard elevated>
            <div className="section-heading">
              <div>
                <p className="eyebrow">01 · Cost structure</p>
                <h2>Your costs</h2>
              </div>
              <ClayButton variant="secondary" onClick={addItem}>
                + Add cost
              </ClayButton>
            </div>

            <div className="cost-table" role="group" aria-label="Cost items">
              <div className="cost-row cost-row--head">
                <span>Cost item</span>
                <span>Type</span>
                <span>Amount</span>
                <span aria-hidden="true" />
              </div>

              {items.map((item) => (
                <div className="cost-row" key={item.id}>
                  <ClayInput
                    aria-label={`Name for ${item.name}`}
                    value={item.name}
                    onChange={(event) =>
                      updateItem(item.id, { name: event.target.value })
                    }
                  />
                  <ClaySelect
                    aria-label={`Cost type for ${item.name}`}
                    value={item.kind}
                    onChange={(event) =>
                      updateItem(item.id, { kind: event.target.value as CostKind })
                    }
                  >
                    <option value="variable">Variable</option>
                    <option value="fixed">Fixed</option>
                  </ClaySelect>
                  <ClayInput
                    aria-label={`Amount for ${item.name}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={item.amount}
                    onChange={(event) =>
                      updateItem(item.id, { amount: toNumber(event.target.value) })
                    }
                  />
                  <button
                    className="remove-button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    title="Remove cost"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="cost-totals">
              <span>
                Variable <strong>{money(metrics.variableCost, currency)}</strong>
              </span>
              <span>
                Fixed <strong>{money(metrics.fixedCost, currency)}</strong>
              </span>
              <span>
                Total <strong>{money(metrics.totalCost, currency)}</strong>
              </span>
            </div>
          </ClayCard>

          <ClayCard elevated>
            <div className="section-heading">
              <div>
                <p className="eyebrow">02 · Output & pricing</p>
                <h2>Production or delivery</h2>
              </div>
            </div>

            <div className="field-grid field-grid--three">
              <label className="field">
                <span>Quantity</span>
                <ClayInput
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.max(1, toNumber(event.target.value)))
                  }
                />
              </label>

              <label className="field">
                <span>Unit name</span>
                <ClayInput
                  value={unit}
                  placeholder="pcs, hour, project..."
                  onChange={(event) => setUnit(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Selling price / {unit || "unit"}</span>
                <ClayInput
                  type="number"
                  min="0"
                  value={sellingPrice}
                  onChange={(event) => setSellingPrice(toNumber(event.target.value))}
                />
              </label>
            </div>

            <div className="margin-control">
              <div className="margin-copy">
                <span>Target margin</span>
                <strong>{targetMargin}%</strong>
              </div>
              <input
                className="clay-range"
                type="range"
                min="0"
                max="80"
                step="1"
                value={targetMargin}
                onChange={(event) =>
                  setTargetMargin(clamp(toNumber(event.target.value), 0, 80))
                }
              />
              <div className="range-labels">
                <span>0%</span>
                <span>40%</span>
                <span>80%</span>
              </div>
            </div>
          </ClayCard>
        </div>

        <aside className="workspace-side">
          <ClayCard className="result-card result-card--primary" elevated>
            <p className="eyebrow">Suggested price</p>
            <div className="result-hero">
              {money(metrics.suggestedPrice, currency)}
            </div>
            <p>
              per {unit || "unit"} for a {targetMargin}% target gross margin.
            </p>
            <div className="result-divider" />
            <div className="result-line">
              <span>Cost / {unit || "unit"}</span>
              <strong>{money(metrics.totalCostPerUnit, currency)}</strong>
            </div>
            <div className="result-line">
              <span>Variable cost / {unit || "unit"}</span>
              <strong>{money(metrics.variableCostPerUnit, currency)}</strong>
            </div>
          </ClayCard>

          <div className="metric-grid">
            <ClayCard className="metric metric--mint">
              <span>Revenue</span>
              <strong>{money(metrics.revenue, currency)}</strong>
            </ClayCard>
            <ClayCard className="metric metric--peach">
              <span>Profit</span>
              <strong>{money(metrics.profit, currency)}</strong>
            </ClayCard>
            <ClayCard className="metric">
              <span>Margin</span>
              <strong>{formatNumber(metrics.actualMargin, 1)}%</strong>
            </ClayCard>
            <ClayCard className="metric">
              <span>Markup</span>
              <strong>{formatNumber(metrics.markup, 1)}%</strong>
            </ClayCard>
          </div>

          <ClayCard elevated>
            <div className="section-heading section-heading--compact">
              <div>
                <p className="eyebrow">Break-even</p>
                <h2>
                  {metrics.breakEvenUnits > 0
                    ? `${formatNumber(metrics.breakEvenUnits, 0)} ${unit || "units"}`
                    : "Not available"}
                </h2>
              </div>
            </div>
            <p className="supporting-copy">
              {metrics.contribution > 0
                ? `Contribution per ${unit || "unit"}: ${money(
                    metrics.contribution,
                    currency,
                  )}.`
                : "Selling price must be higher than variable cost per unit."}
            </p>
          </ClayCard>

          <div className="privacy-note">
            <span className="privacy-dot" />
            Saved locally in this browser. No account or database required.
          </div>
        </aside>
      </section>

      <footer>
        <span>Costing</span>
        <span>Cost · Price · Profit, clearly.</span>
      </footer>
    </main>
  );
}
