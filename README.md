# Costing

A generic, browser-first calculator for cost, unit economics, pricing, margin, markup, profit, and break-even.

**Product name:** Costing  
**Planned URL:** `costing.astakula.com`  
**UI direction:** mature Claymorphism  
**Data model:** local-only MVP, no backend/database required

## MVP

- Dynamic cost items
- Variable vs fixed cost classification
- Quantity and custom unit
- Multi-currency display
- Cost per unit
- Suggested selling price from target margin
- Revenue, profit, gross margin, and markup
- Break-even units
- Local browser persistence
- Responsive Claymorphism UI

## Stack

- Next.js 16.3.8
- React 19.3
- TypeScript
- Tailwind CSS 4.3
- shadcn-compatible project structure

The Claymorphism layer is implemented locally so the project stays lightweight and fully editable. The repository remains compatible with shadcn registries if we want to add third-party components later.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Build

```bash
npm run build
```

## Optional: 1st-Pouf registry

If we later want to introduce components from the 1st-Pouf Claymorphism registry, this project already includes a `components.json` compatible with the shadcn CLI.

Example:

```bash
npx shadcn@latest add https://1st-pouf.worksonmy.dev/r/button.json
```

Review installed files before replacing the local Clay components, because the current UI has been intentionally tuned to a more restrained business-tool aesthetic.

## Calculation model

For a batch/output quantity `Q`:

```text
Variable cost per unit = total variable cost / Q
Total cost per unit    = (variable cost + fixed cost) / Q
Suggested price        = total cost per unit / (1 - target margin)
Revenue                = selling price × Q
Profit                 = revenue - total cost
Margin                 = profit / revenue
Markup                 = profit / total cost
Break-even units       = fixed cost / (selling price - variable cost per unit)
```

Break-even is only shown when the contribution per unit is positive.

## Next

- Named scenarios / saved calculations
- Import/export JSON
- PDF/CSV export
- Pricing presets
- Tax / fee layers
- Marketplace-fee mode
- Shareable read-only calculation links
- Optional account/backend
