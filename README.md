# StockFlow — Inventory Management System (Manufacturing edition)

A complete inventory management system built with **Next.js 16** (App Router,
TypeScript, Tailwind CSS v4) and **Firebase** (Authentication + Firestore),
purpose-built for a company that **manufactures devices** (e.g. cameras,
smart-home hardware) out of purchased components.

This README is written assuming you're new to Next.js. Read it top to bottom
before you start clicking around the code.

---

## 1. The core idea — three kinds of "stock"

| Concept | What it is | Example |
|---|---|---|
| **Raw material** | A component you **buy** from a supplier | Camera sensor, PCB, plastic casing, USB cable |
| **Product** | A finished device you **build** and **sell** | "1080p Indoor Security Camera" |
| **Bill of Materials (BOM)** | The recipe: how much of each raw material it takes to build ONE unit of a product | 1 camera = 1 sensor + 1 PCB + 1 casing + 2 screws |

Stock flows in one direction through the business:
```
Supplier --(Purchase Order)--> Raw materials --(Production / BOM)--> Products --(Sales Order)--> Customer
```

## 2. What's inside (feature list)

| Area | What it does |
|---|---|
| **Authentication** | Email/password sign up and sign in via Firebase Auth. First person to sign up becomes an admin. |
| **Dashboard** | Finished-goods value, raw-material value, low-stock count, out-of-stock count (across both). "Needs attention" list and recent stock activity feed. |
| **Products** | Full CRUD for finished devices — SKU, name, category, selling price, reorder level, unit, image URL, and **its Bill of Materials** (which raw materials + how much it takes to build one unit). Search + filter by category/stock level. |
| **Raw materials** | Full CRUD for components you buy in — SKU, name, category, supplier, cost per unit, reorder level, unit. |
| **Production** | Pick a product and a quantity to build. The page shows exactly which raw materials are needed and whether you have enough, then building it in one click deducts the raw materials and adds the finished units — logged as a "production run". |
| **Categories** | Full CRUD, shared between products and raw materials so you can organize both (e.g. "Sensors", "Cameras", "Smart plugs"). |
| **Suppliers** | Full CRUD with contact details, used on raw materials and purchase orders. |
| **Stock movements** | Every stock-in / stock-out for **either** raw materials or products is recorded with a reason (purchase, production, sale, return, damaged, correction) and who did it. This is your audit trail — quantity can only change through a movement, a PO receipt, a production run, or an order fulfillment, so the numbers can never drift apart. |
| **Purchase orders** | Order **raw materials** from a supplier with multiple line items. Receive stock against each line (supports partial receiving) — receiving automatically increases raw material quantity and logs a stock movement. |
| **Sales orders** | Sell **finished products** to a customer with multiple line items. "Fulfill" the order to deduct product stock for every line at once (or reject the whole thing if any item doesn't have enough stock) and log stock movements. |
| **Reports** | Raw material value by category, finished goods value by category (bar charts), stock in/out trend for the last 14 days (line chart), top raw materials by value, and a one-click CSV export covering both raw materials and products. |
| **Settings / team** | See your profile. Admins can see everyone who's signed up and change their role (admin/staff). |
| **Responsive UI** | Sidebar collapses into a mobile drawer, tables scroll horizontally on small screens, forms stack on mobile. |

### What was deliberately left out of this first version (and why)
These are common in bigger MRP/ERP systems, but were skipped to keep this a
shippable, understandable v1. They're straightforward to add later:
- Multi-step / nested BOMs (a raw material that is itself assembled from other raw materials — "sub-assemblies"). Right now a BOM is one level deep: product ← raw materials.
- Multi-warehouse / multi-location stock (right now there's one stock number per item).
- Barcode scanning / printing.
- Image upload to Firebase Storage (right now products take an image **URL** — you can paste a link from anywhere).
- Invoicing / payments / accounting integration.
- Fine-grained Firestore security rules per role (see `firestore.rules` — currently any signed-in user can read/write everything; role checks are enforced in the UI only).
- Reserving raw materials for a planned build before you actually click "Build" (right now availability is only checked at the moment you build).

If your client needs any of these, tell me and I'll build them next.

---

## 2. How the project is organized

```
src/
  app/
    login/page.tsx              Sign in / sign up page
    (app)/                      Everything behind login shares this folder
      layout.tsx                 Wraps pages in the sidebar/header (AppShell)
      dashboard/page.tsx
      products/page.tsx          Finished devices + their Bill of Materials
      raw-materials/page.tsx     Components you buy from suppliers
      production/page.tsx        Build products from raw materials (BOM)
      categories/page.tsx
      suppliers/page.tsx
      stock-movements/page.tsx   Manual stock in/out for either item type
      purchase-orders/page.tsx           Order raw materials from a supplier
      purchase-orders/[id]/page.tsx      Receive raw materials against a PO
      sales-orders/page.tsx              Sell finished products
      sales-orders/[id]/page.tsx         Fulfill an order (deducts stock)
      reports/page.tsx
      settings/page.tsx
    layout.tsx                  Root layout (auth provider, toasts)
    page.tsx                    Redirects "/" to /dashboard or /login
    globals.css                 Design tokens (colors, fonts) for Tailwind v4

  components/
    ui/                         Generic building blocks: Button, Input, Modal,
                                 Card, Badge, ConfirmDialog, EmptyState, StatCard
    layout/                     Sidebar, Header, AppShell (auth guard), PageHeader
    StockHealthBadge.tsx        Shows "In stock / Low stock / Out of stock"

  lib/
    firebase.ts                 Connects to your Firebase project
    auth-context.tsx            React context: useAuth() hook (login/signup/logout)
    firestore-crud.ts           Generic add/update/delete helpers
    inventory-actions.ts        recordStockMovement() — manual stock in/out/adjustment
    purchase-order-actions.ts   receivePurchaseOrderLine() — brings raw materials in
    manufacture-actions.ts      manufactureProduct() — the BOM engine: consumes raw
                                 materials, creates finished units, all-or-nothing
    sales-order-actions.ts      fulfillSalesOrder() — sends finished products out
    hooks/useCollection.ts      Real-time list hook used by every page
    cn.ts                       Small class-name helper

  types/index.ts                Every data shape used in the app, in one file —
                                 start here to see the whole data model at a glance
```

**Why this matters for you:** if you need to change how something behaves,
find it by feature name above rather than guessing. For example, "what
happens when stock changes" always lives in one of the four files in `lib/`
ending in `-actions.ts`.

---

## 3. One-time setup

### Step 1 — Install Node.js
You need Node.js 20 or newer. Check with `node -v`. If you don't have it,
install it from [nodejs.org](https://nodejs.org).

### Step 2 — Install project dependencies
Open a terminal in this folder and run:
```bash
npm install
```
This downloads everything listed in `package.json`, including packages added
for this project beyond what you started with:
- `lucide-react` — icons used throughout the UI
- `react-hot-toast` — the little success/error popups ("toasts")
- `date-fns` — formats dates like "13 Jul 2026"
- `recharts` — the charts on the Reports page
- `clsx` — a tiny helper for combining CSS classes conditionally

### Step 3 — Create a Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project (free "Spark" plan is enough to start).
2. In the left menu: **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
3. In the left menu: **Build → Firestore Database → Create database** (start in production mode, pick the region closest to your users).
4. Go to **Project settings** (gear icon) → scroll to "Your apps" → click the **Web** icon (`</>`) → register an app (any nickname) → copy the `firebaseConfig` values shown.

### Step 4 — Add your Firebase keys to this project
Copy `.env.local.example` to a new file named `.env.local` in the project
root, and paste in the values from Step 3:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```
`.env.local` is already in `.gitignore` so it never gets committed or shared by accident.

### Step 5 — Deploy the Firestore security rules
This project comes with `firestore.rules` (read the comments inside it — it
explains what it does and doesn't protect against). Deploy it by pasting its
contents into **Firestore Database → Rules** in the Firebase Console, and
clicking **Publish**.

### Step 6 — Run the app
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000). You'll land on the
sign-in page. Click **Create account** — the very first account you create
becomes the workspace admin.

---

## 4. Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app locally for development, with hot-reload. |
| `npm run build` | Builds an optimized production version (also catches type errors). |
| `npm run start` | Runs the production build (run `build` first). |
| `npm run lint` | Checks code style/quality. |

## 5. Deploying so your client can use it online

The easiest option for a Next.js app like this is **[Vercel](https://vercel.com)**
(made by the Next.js team, has a free tier):
1. Push this project to a GitHub repository.
2. Go to vercel.com → New Project → import that repository.
3. Add the same six `NEXT_PUBLIC_FIREBASE_*` variables from your `.env.local` under **Environment Variables**.
4. Click Deploy. Vercel gives you a live URL in a couple of minutes.

## 6. How the important business rules work

- **Stock quantity is never edited directly** on a product or raw material
  after it's created. Every increase/decrease goes through a "stock
  movement" (Stock in/out page, receiving a purchase order, building a
  product, or fulfilling a sales order). This guarantees your quantity
  numbers and your history log always agree — a very common bug in
  home-grown inventory tools is these two silently drifting apart.
- **The Bill of Materials (BOM)** lives on the product itself — when you
  edit a product on the Products page, there's a "Bill of Materials"
  section where you pick which raw materials it needs and how much of each,
  per single unit built.
- **Building a product** (Production page) looks at the BOM, multiplies
  each line by the quantity you want to build, and checks every raw
  material has enough stock *before* changing anything. If even one
  material is short, the whole build is rejected — you never end up with
  half-consumed materials and no finished product to show for it.
- **Receiving a purchase order**, **building a product**, and **fulfilling a
  sales order** all update Firestore inside a single atomic "transaction,"
  so if two people do something to the same item at the same second, or if
  there isn't enough stock, nothing gets left half-updated.
- **Low stock** is any item where quantity has dropped to (or below) its
  "reorder level" — you set that per product/raw material. Out-of-stock is
  quantity 0. This applies to raw materials and finished products alike.

## 7. Design notes
The interface deliberately avoids a dark or purple theme. It uses a clean
white/slate background with a teal accent color for actions, amber for
low-stock warnings, and rose for critical/danger states — a palette meant to
read as calm, professional business software rather than a marketing site.
