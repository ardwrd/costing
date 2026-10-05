"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ClayButton, ClayCard, ClayInput, ClaySelect } from "@/components/ui/clay";
import { clamp, toNumber } from "@/lib/utils";

type CostBasis = "unit" | "batch" | "fixed";
type TargetMode = "margin" | "markup";
type Currency = "IDR" | "USD" | "SGD" | "MYR" | "EUR";
type TemplateKey = "product" | "fnb" | "service" | "reseller" | "project" | "custom";

type CostItem = {
  id: string;
  name: string;
  amount: number;
  basis: CostBasis;
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

const STORAGE_KEY = "costing:v2";

const templates: Record<
  TemplateKey,
  {
    label: string;
    scenarioName: string;
    quantity: number;
    unit: string;
    items: Omit<CostItem, "id">[];
  }
> = {
  product: {
    label: "Product",
    scenarioName: "Product costing",
    quantity: 100,
    unit: "pcs",
    items: [
      { name: "Raw materials", amount: 25000, basis: "unit" },
      { name: "Packaging", amount: 3000, basis: "unit" },
      { name: "Direct labor", amount: 250000, basis: "batch" },
      { name: "Overhead allocation", amount: 500000, basis: "fixed" },
    ],
  },
  fnb: {
    label: "F&B",
    scenarioName: "Menu costing",
    quantity: 50,
    unit: "portion",
    items: [
      { name: "Ingredients", amount: 18000, basis: "unit" },
      { name: "Packaging", amount: 2500, basis: "unit" },
      { name: "Prep labor", amount: 175000, basis: "batch" },
      { name: "Utilities & overhead", amount: 225000, basis: "fixed" },
    ],
  },
  service: {
    label: "Service",
    scenarioName: "Service costing",
    quantity: 1,
    unit: "service",
    items: [
      { name: "Direct labor", amount: 150000, basis: "unit" },
      { name: "Consumables", amount: 25000, basis: "unit" },
      { name: "Admin preparation", amount: 30000, basis: "batch" },
      { name: "Overhead allocation", amount: 50000, basis: "fixed" },
    ],
  },
  reseller: {
    label: "Reseller",
    scenarioName: "Reseller pricing",
    quantity: 20,
    unit: "pcs",
    items: [
      { name: "Purchase cost", amount: 125000, basis: "unit" },
      { name: "Packaging", amount: 4000, basis: "unit" },
      { name: "Inbound shipping", amount: 100000, basis: "batch" },
      { name: "Operating allocation", amount: 150000, basis: "fixed" },
    ],
  },
  project: {
    label: "Project",
    scenarioName: "Project costing",
    quantity: 1,
    unit: "project",
    items: [
      { name: "Project labor", amount: 2500000, basis: "batch" },
      { name: "Materials / tools", amount: 750000, basis: "batch" },
      { name: "Travel / logistics", amount: 350000, basis: "batch" },
      { name: "Business overhead", amount: 500000, basis: "fixed" },
    ],
  },
  custom: {
    label: "Custom",
    scenarioName: "Custom costing",
    quantity: 1,
    unit: "unit",
    items: [
      { name: "Primary cost", amount: 0, basis: "unit" },
      { name: "Other cost", amount: 0, basis: "batch" },
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

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function templateState(key: TemplateKey): CalculatorState {
  const preset = templates[key];
  return {
    scenarioName: preset.scenarioName,
    template: key,
    items: preset.items.map((item) => ({ ...item, id: uid() })),
    quantity: preset.quantity,
    unit: preset.unit,
    sellingPrice: 0,
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
      items: Array.isArray(data.items) && data.items.length ? data.items : defaultState.items,
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
    const perUnitCost = state.items
      .filter((item) => item.basis === "unit")
      .reduce((sum, item) => sum + Math.max(item.amount, 0), 0);
    const batchCost = state.items
      .filter((item) => item.basis === "batch")
      .reduce((sum, item) => sum + Math.max(item.amount, 0), 0);
    const fixedCost = state.items
      .filter((item) => item.basis === "fixed")
      .reduce((sum, item) => sum + Math.max(item.amount, 0), 0);

    const totalCost = perUnitCost * qty + batchCost + fixedCost;
    const costPerUnit = totalCost / qty;
    const fee = clamp(state.feeRate, 0, 90) / 100;
    const target = clamp(state.targetRate, 0, 95) / 100;

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
    const contributionPerUnit = sellingPrice * (1 - fee) - perUnitCost;
    const nonUnitCost = batchCost + fixedCost;
    const breakEvenUnits =
      contributionPerUnit > 0 && nonUnitCost > 0
        ? Math.ceil(nonUnitCost / contributionPerUnit)
        : 0;

    return {
      perUnitCost,
      batchCost,
      fixedCost,
      totalCost,
      costPerUnit,
      targetPrice,
      grossRevenue,
      feeAmount,
      netRevenue,
      profit,
      actualMargin,
      actualMarkup,
      contributionPerUnit,
      breakEvenUnits,
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
        { id: uid(), name: "New cost", amount: 0, basis: "unit" },
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

  if (!hydrated) return <main className="app-shell" aria-hidden="true" />;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark">C</div>
          <div>
            <strong>Costing</strong>
            <span>by Astakula</span>
          </div>
        </div>

        <div className="header-actions">
          <ClaySelect
            className="currency-select"
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

      <section className="page-heading">
        <div>
          <p className="section-kicker">Cost · Price · Profit</p>
          <h1>Costing workspace</h1>
          <p>Build your cost structure, set a pricing target, and see the result instantly.</p>
        </div>
        <label className="scenario-field">
          <span>Scenario</span>
          <ClayInput
            value={state.scenarioName}
            onChange={(event) => patch({ scenarioName: event.target.value })}
          />
        </label>
      </section>

      <nav className="template-tabs" aria-label="Costing templates">
        {(Object.keys(templates) as TemplateKey[]).map((key) => (
          <button
            key={key}
            className={state.template === key ? "template-tab is-active" : "template-tab"}
            onClick={() => chooseTemplate(key)}
          >
            {templates[key].label}
          </button>
        ))}
      </nav>

      <section className="workspace-v2">
        <div className="workspace-column">
          <ClayCard className="panel">
            <div className="panel-heading">
              <div>
                <span className="step-label">01</span>
                <div>
                  <h2>Cost structure</h2>
                  <p>Add every cost required to produce or deliver this output.</p>
                </div>
              </div>
              <ClayButton variant="secondary" onClick={addItem}>+ Add cost</ClayButton>
            </div>

            <div className="cost-editor">
              <div className="cost-editor-head">
                <span>Cost item</span>
                <span>Basis</span>
                <span>Amount</span>
                <span />
              </div>

              {state.items.map((item) => (
                <div className="cost-editor-row" key={item.id}>
                  <ClayInput
                    value={item.name}
                    aria-label="Cost item name"
                    onChange={(event) => updateItem(item.id, { name: event.target.value })}
                  />
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
                  <button
                    className="icon-button"
                    aria-label={`Remove ${item.name}`}
                    disabled={state.items.length <= 1}
                    onClick={() => removeItem(item.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="cost-summary-strip">
              <div>
                <span>Per unit</span>
                <strong>{money(metrics.perUnitCost, state.currency)}</strong>
              </div>
              <div>
                <span>Per batch</span>
                <strong>{money(metrics.batchCost, state.currency)}</strong>
              </div>
              <div>
                <span>Fixed</span>
                <strong>{money(metrics.fixedCost, state.currency)}</strong>
              </div>
              <div className="summary-total">
                <span>Total cost</span>
                <strong>{money(metrics.totalCost, state.currency)}</strong>
              </div>
            </div>
          </ClayCard>

          <ClayCard className="panel">
            <div className="panel-heading">
              <div>
                <span className="step-label">02</span>
                <div>
                  <h2>Output & selling price</h2>
                  <p>Define the output quantity and the price you plan to charge.</p>
                </div>
              </div>
            </div>

            <div className="form-grid three-columns">
              <label className="field-v2">
                <span>Quantity</span>
                <ClayInput
                  type="number"
                  min="1"
                  value={state.quantity}
                  onChange={(event) => patch({ quantity: Math.max(1, toNumber(event.target.value)) })}
                />
              </label>
              <label className="field-v2">
                <span>Unit</span>
                <ClayInput
                  value={state.unit}
                  placeholder="pcs, portion, hour..."
                  onChange={(event) => patch({ unit: event.target.value })}
                />
              </label>
              <label className="field-v2">
                <span>Selling price / {state.unit || "unit"}</span>
                <ClayInput
                  type="number"
                  min="0"
                  value={state.sellingPrice}
                  onChange={(event) => patch({ sellingPrice: Math.max(0, toNumber(event.target.value)) })}
                />
              </label>
            </div>
          </ClayCard>

          <ClayCard className="panel">
            <div className="panel-heading">
              <div>
                <span className="step-label">03</span>
                <div>
                  <h2>Pricing target</h2>
                  <p>Choose how you want the recommended selling price to be calculated.</p>
                </div>
              </div>
            </div>

            <div className="pricing-grid">
              <div className="target-mode-control">
                <span className="field-label">Target method</span>
                <div className="segmented-control">
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
              </div>

              <label className="field-v2">
                <span>Target {state.targetMode}</span>
                <div className="suffix-input">
                  <ClayInput
                    type="number"
                    min="0"
                    max="95"
                    value={state.targetRate}
                    onChange={(event) => patch({ targetRate: clamp(toNumber(event.target.value), 0, 95) })}
                  />
                  <span>%</span>
                </div>
              </label>

              <label className="field-v2">
                <span>Selling / platform fee</span>
                <div className="suffix-input">
                  <ClayInput
                    type="number"
                    min="0"
                    max="90"
                    value={state.feeRate}
                    onChange={(event) => patch({ feeRate: clamp(toNumber(event.target.value), 0, 90) })}
                  />
                  <span>%</span>
                </div>
              </label>
            </div>
          </ClayCard>
        </div>

        <aside className="summary-column">
          <ClayCard className="summary-panel">
            <div className="summary-header">
              <span>Live summary</span>
              <span className="live-pill">Live</span>
            </div>

            <div className="summary-primary">
              <span>Cost / {state.unit || "unit"}</span>
              <strong>{money(metrics.costPerUnit, state.currency)}</strong>
            </div>

            <div className="recommended-price">
              <span>Recommended price</span>
              <strong>{money(metrics.targetPrice, state.currency)}</strong>
              <small>
                {state.targetRate}% target {state.targetMode}
                {state.feeRate > 0 ? ` · ${state.feeRate}% fee included` : ""}
              </small>
              <ClayButton
                variant="primary"
                onClick={() => patch({ sellingPrice: Math.round(metrics.targetPrice) })}
              >
                Use recommended price
              </ClayButton>
            </div>

            <div className="summary-divider" />

            <div className="summary-list">
              <div>
                <span>Gross revenue</span>
                <strong>{money(metrics.grossRevenue, state.currency)}</strong>
              </div>
              <div>
                <span>Selling fees</span>
                <strong>-{money(metrics.feeAmount, state.currency)}</strong>
              </div>
              <div>
                <span>Net revenue</span>
                <strong>{money(metrics.netRevenue, state.currency)}</strong>
              </div>
              <div className={metrics.profit < 0 ? "negative" : "positive"}>
                <span>Profit</span>
                <strong>{money(metrics.profit, state.currency)}</strong>
              </div>
            </div>

            <div className="metric-cards">
              <div>
                <span>Margin</span>
                <strong>{formatNumber(metrics.actualMargin)}%</strong>
              </div>
              <div>
                <span>Markup</span>
                <strong>{formatNumber(metrics.actualMarkup)}%</strong>
              </div>
            </div>

            <div className="break-even-box">
              <div>
                <span>Break-even</span>
                <strong>
                  {metrics.breakEvenUnits > 0
                    ? `${formatNumber(metrics.breakEvenUnits, 0)} ${state.unit || "units"}`
                    : "—"}
                </strong>
              </div>
              <p>
                {metrics.contributionPerUnit > 0
                  ? `${money(metrics.contributionPerUnit, state.currency)} contribution per ${state.unit || "unit"}.`
                  : "Set a selling price above the per-unit variable cost to calculate break-even."}
              </p>
            </div>
          </ClayCard>

          <p className="local-note">Saved automatically in this browser. No account required.</p>
        </aside>
      </section>

      <footer className="app-footer">
        <span>Costing by Astakula</span>
        <span>Generic business costing & pricing calculator.</span>
      </footer>
    </main>
  );
}
