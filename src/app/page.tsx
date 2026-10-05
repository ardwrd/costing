"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ClayButton, ClayInput, ClaySelect } from "@/components/ui/clay";
import { clamp, toNumber } from "@/lib/utils";

type CostBasis = "unit" | "batch" | "fixed";
type CostCategory = "material" | "labor" | "overhead" | "logistics" | "other";
type TargetMode = "margin" | "markup";
type Currency = "IDR" | "USD" | "SGD" | "MYR" | "EUR";
type TemplateKey = "product" | "fnb" | "service" | "reseller" | "project" | "custom";

type CostItem = {
  id: string;
  name: string;
  amount: number;
  basis: CostBasis;
  category: CostCategory;
};

type CalculatorState = {
  scenarioName: string;
  template: TemplateKey;
  items: CostItem[];
  quantity: number;
  unit: string;
  sellingPrice: number;
  targetMode: TargetMode;
  targetRate: number;
  feeRate: number;
  currency: Currency;
};

const STORAGE_KEY = "costing:v3";

const templates: Record<
  TemplateKey,
  {
    label: string;
    hint: string;
    scenarioName: string;
    quantity: number;
    unit: string;
    items: Omit<CostItem, "id">[];
  }
> = {
  product: {
    label: "Product",
    hint: "Goods & production",
    scenarioName: "Product costing",
    quantity: 100,
    unit: "pcs",
    items: [
      { name: "Raw materials", amount: 25000, basis: "unit", category: "material" },
      { name: "Packaging", amount: 3000, basis: "unit", category: "material" },
      { name: "Direct labor", amount: 250000, basis: "batch", category: "labor" },
      { name: "Overhead allocation", amount: 500000, basis: "fixed", category: "overhead" },
    ],
  },
  fnb: {
    label: "F&B",
    hint: "Menu & recipe",
    scenarioName: "Menu costing",
    quantity: 50,
    unit: "portion",
    items: [
      { name: "Ingredients", amount: 18000, basis: "unit", category: "material" },
      { name: "Packaging", amount: 2500, basis: "unit", category: "material" },
      { name: "Prep labor", amount: 175000, basis: "batch", category: "labor" },
      { name: "Utilities & overhead", amount: 225000, basis: "fixed", category: "overhead" },
    ],
  },
  service: {
    label: "Service",
    hint: "Time & delivery",
    scenarioName: "Service costing",
    quantity: 1,
    unit: "service",
    items: [
      { name: "Direct labor", amount: 150000, basis: "unit", category: "labor" },
      { name: "Consumables", amount: 25000, basis: "unit", category: "material" },
      { name: "Admin preparation", amount: 30000, basis: "batch", category: "labor" },
      { name: "Overhead allocation", amount: 50000, basis: "fixed", category: "overhead" },
    ],
  },
  reseller: {
    label: "Reseller",
    hint: "Buy & resell",
    scenarioName: "Reseller pricing",
    quantity: 20,
    unit: "pcs",
    items: [
      { name: "Purchase cost", amount: 125000, basis: "unit", category: "material" },
      { name: "Packaging", amount: 4000, basis: "unit", category: "material" },
      { name: "Inbound shipping", amount: 100000, basis: "batch", category: "logistics" },
      { name: "Operating allocation", amount: 150000, basis: "fixed", category: "overhead" },
    ],
  },
  project: {
    label: "Project",
    hint: "Quoted work",
    scenarioName: "Project costing",
    quantity: 1,
    unit: "project",
    items: [
      { name: "Project labor", amount: 2500000, basis: "batch", category: "labor" },
      { name: "Materials / tools", amount: 750000, basis: "batch", category: "material" },
      { name: "Travel / logistics", amount: 350000, basis: "batch", category: "logistics" },
      { name: "Business overhead", amount: 500000, basis: "fixed", category: "overhead" },
    ],
  },
  custom: {
    label: "Custom",
    hint: "Start blank",
    scenarioName: "Custom costing",
    quantity: 1,
    unit: "unit",
    items: [
      { name: "Primary cost", amount: 0, basis: "unit", category: "other" },
      { name: "Other cost", amount: 0, basis: "batch", category: "other" },
    ],
  },
};

const currencyLocale: Record<Currency, string> = {
  IDR: "id-ID",
  USD: "en-US",
  SGD: "en-SG",
  MYR: "ms-MY",
  EUR: "de-DE",
};

const categoryLabels: Record<CostCategory, string> = {
  material: "Material",
  labor: "Labor",
  overhead: "Overhead",
  logistics: "Logistics",
  other: "Other",
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function totalForItem(item: CostItem, quantity: number) {
  return item.basis === "unit" ? Math.max(item.amount, 0) * quantity : Math.max(item.amount, 0);
}

function roundPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const step = value >= 100000 ? 5000 : value >= 10000 ? 1000 : value >= 1000 ? 100 : 0.5;
  return Math.ceil(value / step) * step;
}

function templateState(key: TemplateKey): CalculatorState {
  const preset = templates[key];
  const items = preset.items.map((item) => ({ ...item, id: uid() }));
  const totalCost = items.reduce((sum, item) => sum + totalForItem(item, preset.quantity), 0);
  const costPerUnit = totalCost / Math.max(preset.quantity, 1);

  return {
    scenarioName: preset.scenarioName,
    template: key,
    items,
    quantity: preset.quantity,
    unit: preset.unit,
    sellingPrice: roundPrice(costPerUnit / 0.7),
    targetMode: "margin",
    targetRate: 30,
    feeRate: 0,
    currency: "IDR",
  };
}

const defaultState = templateState("product");

function readInitialState(): CalculatorState {
  if (typeof window === "undefined") return defaultState;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const data = JSON.parse(raw) as Partial<CalculatorState>;

    return {
      ...defaultState,
      ...data,
      items:
        Array.isArray(data.items) && data.items.length
          ? data.items.map((item) => ({ ...item, category: item.category ?? "other" }))
          : defaultState.items,
    };
  } catch {
    return defaultState;
  }
}

function subscribeToHydration() {
  return () => {};
}

function useHydrated() {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

function money(value: number, currency: Currency) {
  return new Intl.NumberFormat(currencyLocale[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function Home() {
  const [initial] = useState<CalculatorState>(readInitialState);
  const [state, setState] = useState<CalculatorState>(initial);
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const metrics = useMemo(() => {
    const qty = Math.max(state.quantity, 1);
    const fee = clamp(state.feeRate, 0, 90) / 100;
    const target = clamp(state.targetRate, 0, 95) / 100;
    const unitBasisCost = state.items
      .filter((item) => item.basis === "unit")
      .reduce((sum, item) => sum + Math.max(item.amount, 0), 0);
    const batchCost = state.items
      .filter((item) => item.basis === "batch")
      .reduce((sum, item) => sum + Math.max(item.amount, 0), 0);
    const fixedCost = state.items
      .filter((item) => item.basis === "fixed")
      .reduce((sum, item) => sum + Math.max(item.amount, 0), 0);
    const itemTotals = state.items.map((item) => ({
      ...item,
      total: totalForItem(item, qty),
    }));
    const totalCost = itemTotals.reduce((sum, item) => sum + item.total, 0);
    const costPerUnit = totalCost / qty;
    const breakEvenPrice = costPerUnit / Math.max(1 - fee, 0.01);
    const targetPrice =
      state.targetMode === "margin"
        ? costPerUnit / Math.max(1 - fee - target, 0.01)
        : (costPerUnit * (1 + target)) / Math.max(1 - fee, 0.01);

    const sellingPrice = Math.max(state.sellingPrice, 0);
    const grossRevenue = sellingPrice * qty;
    const feeAmount = grossRevenue * fee;
    const netRevenue = grossRevenue - feeAmount;
    const profit = netRevenue - totalCost;
    const actualMargin = grossRevenue > 0 ? (profit / grossRevenue) * 100 : 0;
    const actualMarkup = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const contributionPerUnit = sellingPrice * (1 - fee) - unitBasisCost;
    const nonUnitCost = batchCost + fixedCost;
    const breakEvenUnits =
      contributionPerUnit > 0 && nonUnitCost > 0
        ? Math.ceil(nonUnitCost / contributionPerUnit)
        : 0;

    const priceForMargin = (margin: number) =>
      costPerUnit / Math.max(1 - fee - margin / 100, 0.01);

    const scenarioFor = (name: string, price: number) => {
      const revenue = price * qty;
      const scenarioProfit = revenue * (1 - fee) - totalCost;
      return {
        name,
        price,
        profit: scenarioProfit,
        margin: revenue > 0 ? (scenarioProfit / revenue) * 100 : 0,
      };
    };

    return {
      unitBasisCost,
      batchCost,
      fixedCost,
      totalCost,
      costPerUnit,
      breakEvenPrice,
      targetPrice,
      grossRevenue,
      feeAmount,
      netRevenue,
      profit,
      actualMargin,
      actualMarkup,
      contributionPerUnit,
      breakEvenUnits,
      itemTotals,
      pricingLadder: [
        { label: "Break-even", rate: 0, price: breakEvenPrice },
        { label: "20% margin", rate: 20, price: priceForMargin(20) },
        { label: "30% margin", rate: 30, price: priceForMargin(30) },
        { label: "40% margin", rate: 40, price: priceForMargin(40) },
      ],
      scenarios: [
        scenarioFor("Current", sellingPrice),
        scenarioFor("Recommended", targetPrice),
        scenarioFor("Stretch +10%", targetPrice * 1.1),
      ],
    };
  }, [state]);

  function patch(patchState: Partial<CalculatorState>) {
    setState((current) => ({ ...current, ...patchState }));
  }

  function chooseTemplate(key: TemplateKey) {
    const next = templateState(key);
    next.currency = state.currency;
    setState(next);
  }

  function updateItem(id: string, patchItem: Partial<CostItem>) {
    patch({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...patchItem } : item,
      ),
    });
  }

  function addItem() {
    patch({
      items: [
        ...state.items,
        { id: uid(), name: "New cost", amount: 0, basis: "unit", category: "other" },
      ],
    });
  }

  function removeItem(id: string) {
    if (state.items.length <= 1) return;
    patch({ items: state.items.filter((item) => item.id !== id) });
  }

  function reset() {
    const next = templateState(state.template);
    next.currency = state.currency;
    setState(next);
  }

  if (!hydrated) return <main className="app-shell-v3" aria-hidden="true" />;

  const priceGap = state.sellingPrice - metrics.targetPrice;

  return (
    <main className="app-shell-v3">
      <header className="app-topbar-v3">
        <div className="brand-v3">
          <span className="brand-symbol">C</span>
          <span className="brand-wordmark">Costing</span>
          <span className="brand-byline">by Astakula</span>
        </div>

        <label className="scenario-title">
          <span className="sr-only">Scenario name</span>
          <input
            value={state.scenarioName}
            onChange={(event) => patch({ scenarioName: event.target.value })}
          />
        </label>

        <div className="topbar-tools">
          <ClaySelect
            className="currency-v3"
            aria-label="Currency"
            value={state.currency}
            onChange={(event) => patch({ currency: event.target.value as Currency })}
          >
            <option value="IDR">IDR</option>
            <option value="USD">USD</option>
            <option value="SGD">SGD</option>
            <option value="MYR">MYR</option>
            <option value="EUR">EUR</option>
          </ClaySelect>
          <ClayButton variant="quiet" onClick={reset}>Reset</ClayButton>
        </div>
      </header>

      <section className="workspace-shell-v3">
        <aside className="setup-rail">
          <div className="rail-section">
            <p className="rail-label">Template</p>
            <div className="template-list-v3">
              {(Object.keys(templates) as TemplateKey[]).map((key) => (
                <button
                  key={key}
                  className={state.template === key ? "template-item is-active" : "template-item"}
                  onClick={() => chooseTemplate(key)}
                >
                  <span>{templates[key].label}</span>
                  <small>{templates[key].hint}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="rail-section rail-fields">
            <p className="rail-label">Output</p>
            <label className="compact-field">
              <span>Quantity</span>
              <ClayInput
                type="number"
                min="1"
                value={state.quantity}
                onChange={(event) => patch({ quantity: Math.max(1, toNumber(event.target.value)) })}
              />
            </label>
            <label className="compact-field">
              <span>Unit</span>
              <ClayInput
                value={state.unit}
                placeholder="pcs, hour..."
                onChange={(event) => patch({ unit: event.target.value })}
              />
            </label>
          </div>

          <div className="rail-section rail-fields">
            <p className="rail-label">Pricing target</p>
            <div className="target-toggle-v3" aria-label="Pricing target method">
              <button
                className={state.targetMode === "margin" ? "is-active" : ""}
                onClick={() => patch({ targetMode: "margin" })}
              >
                Margin
              </button>
              <button
                className={state.targetMode === "markup" ? "is-active" : ""}
                onClick={() => patch({ targetMode: "markup" })}
              >
                Markup
              </button>
            </div>
            <label className="compact-field">
              <span>Target {state.targetMode}</span>
              <div className="input-suffix-v3">
                <ClayInput
                  type="number"
                  min="0"
                  max="95"
                  value={state.targetRate}
                  onChange={(event) => patch({ targetRate: clamp(toNumber(event.target.value), 0, 95) })}
                />
                <b>%</b>
              </div>
            </label>
            <label className="compact-field">
              <span>Selling / platform fee</span>
              <div className="input-suffix-v3">
                <ClayInput
                  type="number"
                  min="0"
                  max="90"
                  value={state.feeRate}
                  onChange={(event) => patch({ feeRate: clamp(toNumber(event.target.value), 0, 90) })}
                />
                <b>%</b>
              </div>
            </label>
          </div>

          <p className="rail-note">Currency changes the denomination only. Values are not converted.</p>
        </aside>

        <section className="working-canvas">
          <div className="canvas-section cost-section-v3">
            <div className="section-title-v3">
              <div>
                <p className="eyebrow-v3">Cost structure</p>
                <h1>Build the true cost</h1>
              </div>
              <ClayButton variant="secondary" onClick={addItem}>+ Add cost</ClayButton>
            </div>

            <div className="cost-table-v3">
              <div className="cost-table-head-v3">
                <span>Cost item</span>
                <span>Category</span>
                <span>Basis</span>
                <span>Amount</span>
                <span>Effective / {state.unit || "unit"}</span>
                <span />
              </div>

              {state.items.map((item) => {
                const effective = totalForItem(item, Math.max(state.quantity, 1)) / Math.max(state.quantity, 1);
                return (
                  <div className="cost-table-row-v3" key={item.id}>
                    <ClayInput
                      value={item.name}
                      aria-label="Cost item name"
                      onChange={(event) => updateItem(item.id, { name: event.target.value })}
                    />
                    <ClaySelect
                      value={item.category}
                      aria-label="Cost category"
                      onChange={(event) =>
                        updateItem(item.id, { category: event.target.value as CostCategory })
                      }
                    >
                      {(Object.keys(categoryLabels) as CostCategory[]).map((category) => (
                        <option key={category} value={category}>{categoryLabels[category]}</option>
                      ))}
                    </ClaySelect>
                    <ClaySelect
                      value={item.basis}
                      aria-label="Cost basis"
                      onChange={(event) =>
                        updateItem(item.id, { basis: event.target.value as CostBasis })
                      }
                    >
                      <option value="unit">Per unit</option>
                      <option value="batch">Per batch</option>
                      <option value="fixed">Fixed</option>
                    </ClaySelect>
                    <ClayInput
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={item.amount}
                      aria-label="Cost amount"
                      onChange={(event) =>
                        updateItem(item.id, { amount: Math.max(0, toNumber(event.target.value)) })
                      }
                    />
                    <span className="effective-cost">{money(effective, state.currency)}</span>
                    <button
                      className="remove-row"
                      aria-label={`Remove ${item.name}`}
                      disabled={state.items.length <= 1}
                      onClick={() => removeItem(item.id)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="table-total-v3">
              <span>Total planned cost</span>
              <strong>{money(metrics.totalCost, state.currency)}</strong>
              <span>Cost / {state.unit || "unit"}</span>
              <strong>{money(metrics.costPerUnit, state.currency)}</strong>
            </div>
          </div>

          <div className="canvas-section breakdown-section">
            <div className="section-title-v3 compact">
              <div>
                <p className="eyebrow-v3">Cost breakdown</p>
                <h2>Where the money goes</h2>
              </div>
            </div>

            <div className="breakdown-list">
              {metrics.itemTotals.map((item) => {
                const share = metrics.totalCost > 0 ? (item.total / metrics.totalCost) * 100 : 0;
                return (
                  <div className="breakdown-row" key={item.id}>
                    <div className="breakdown-meta">
                      <span>{item.name || "Untitled cost"}</span>
                      <strong>{formatNumber(share, 0)}%</strong>
                    </div>
                    <div className="breakdown-track" aria-hidden="true">
                      <span style={{ width: `${Math.min(share, 100)}%` }} />
                    </div>
                    <span className="breakdown-value">{money(item.total, state.currency)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="canvas-section pricing-intelligence">
            <div className="section-title-v3 compact">
              <div>
                <p className="eyebrow-v3">Pricing intelligence</p>
                <h2>Price points, not guesses</h2>
              </div>
            </div>

            <div className="price-ladder">
              {metrics.pricingLadder.map((row) => (
                <div className="price-ladder-row" key={row.label}>
                  <span>{row.label}</span>
                  <strong>{money(row.price, state.currency)}</strong>
                  <button onClick={() => patch({ sellingPrice: roundPrice(row.price) })}>Use</button>
                </div>
              ))}
              <div className="price-ladder-row target-row">
                <span>Your target {state.targetMode}</span>
                <strong>{money(metrics.targetPrice, state.currency)}</strong>
                <button onClick={() => patch({ sellingPrice: roundPrice(metrics.targetPrice) })}>Use</button>
              </div>
            </div>

            <div className="scenario-table">
              <div className="scenario-table-head">
                <span>Scenario</span>
                <span>Price</span>
                <span>Margin</span>
                <span>Profit</span>
              </div>
              {metrics.scenarios.map((scenario) => (
                <div className="scenario-table-row" key={scenario.name}>
                  <span>{scenario.name}</span>
                  <strong>{money(scenario.price, state.currency)}</strong>
                  <span>{formatNumber(scenario.margin)}%</span>
                  <span className={scenario.profit < 0 ? "text-negative" : "text-positive"}>
                    {money(scenario.profit, state.currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="inspector-v3">
          <div className="inspector-inner">
            <div className="inspector-heading">
              <span>Pricing summary</span>
              <span className="live-status"><i /> Live</span>
            </div>

            <div className="primary-readout">
              <span>Recommended price</span>
              <strong>{money(metrics.targetPrice, state.currency)}</strong>
              <small>
                {state.targetRate}% {state.targetMode}
                {state.feeRate > 0 ? ` · includes ${state.feeRate}% fee` : ""}
              </small>
            </div>

            <ClayButton
              className="use-price-button"
              variant="primary"
              onClick={() => patch({ sellingPrice: roundPrice(metrics.targetPrice) })}
            >
              Use recommended price
            </ClayButton>

            <div className="inspector-divider" />

            <label className="selling-price-field">
              <span>Your selling price / {state.unit || "unit"}</span>
              <ClayInput
                type="number"
                min="0"
                value={state.sellingPrice}
                onChange={(event) => patch({ sellingPrice: Math.max(0, toNumber(event.target.value)) })}
              />
            </label>

            <div className={priceGap >= 0 ? "price-signal positive" : "price-signal negative"}>
              <span>{priceGap >= 0 ? "Above target" : "Below target"}</span>
              <strong>{money(Math.abs(priceGap), state.currency)}</strong>
            </div>

            <dl className="metric-list-v3">
              <div><dt>Cost / {state.unit || "unit"}</dt><dd>{money(metrics.costPerUnit, state.currency)}</dd></div>
              <div><dt>Total cost</dt><dd>{money(metrics.totalCost, state.currency)}</dd></div>
              <div><dt>Gross revenue</dt><dd>{money(metrics.grossRevenue, state.currency)}</dd></div>
              <div><dt>Selling fees</dt><dd>-{money(metrics.feeAmount, state.currency)}</dd></div>
              <div><dt>Net revenue</dt><dd>{money(metrics.netRevenue, state.currency)}</dd></div>
              <div className="metric-emphasis"><dt>Profit</dt><dd className={metrics.profit < 0 ? "text-negative" : "text-positive"}>{money(metrics.profit, state.currency)}</dd></div>
            </dl>

            <div className="ratio-grid-v3">
              <div><span>Margin</span><strong>{formatNumber(metrics.actualMargin)}%</strong></div>
              <div><span>Markup</span><strong>{formatNumber(metrics.actualMarkup)}%</strong></div>
            </div>

            <div className="inspector-divider" />

            <div className="break-even-v3">
              <span>Break-even volume</span>
              <strong>
                {metrics.breakEvenUnits > 0
                  ? `${formatNumber(metrics.breakEvenUnits, 0)} ${state.unit || "units"}`
                  : "—"}
              </strong>
              <p>
                {metrics.contributionPerUnit > 0
                  ? `${money(metrics.contributionPerUnit, state.currency)} contribution per ${state.unit || "unit"}.`
                  : "Raise the selling price above variable cost to calculate break-even."}
              </p>
            </div>

            <p className="autosave-note">Auto-saved locally in this browser.</p>
          </div>
        </aside>
      </section>

      <footer className="footer-v3">
        <span>Costing by Astakula</span>
        <span>Cost · Price · Profit</span>
      </footer>
    </main>
  );
}
