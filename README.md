# Data Density Heatmap

![Data Density Heatmap](https://img.shields.io/badge/Status-Active-success) ![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Styled-38B2AC) ![D3.js](https://img.shields.io/badge/D3.js-Visualized-F9A03C)

## 📖 Overview

**Data Density Heatmap** is a powerful, web-based visualization tool designed to analyze and represent the completeness and distribution of data across an entire GraphQL dataset.

When working with large, complex datasets, it is often difficult to know which fields are consistently populated and which are frequently left blank. This application solves that problem by calculating the "data density" (the percentage of non-null, non-empty values) for every field across selected GraphQL node types. It then visualizes this data using an interactive heatmap, enabling developers, researchers, and data managers to quickly identify areas with high or low data availability.

## 🎯 The Problem It Solves

In modern applications, GraphQL schemas can grow incredibly large. While the schema defines _what_ data can exist, it doesn't tell you _how much_ data actually exists.

- Are users actually filling out their `bio` field?
- Is the `updatedAt` timestamp consistently applied across all records?
- Which optional fields are practically unused?

**Data Density Heatmap** answers these questions instantly without requiring complex SQL queries or manual data analysis. It provides a bird's-eye view of your data's health and completeness.

## ⚙️ End-to-End Mechanism: How It Works

The application operates in a seamless, three-step pipeline:

### 1. Connection & Introspection

- The user provides a **GraphQL Endpoint URL** and any necessary authentication headers (e.g., `Authorization: Bearer <token>`).
- The app sends a standard GraphQL Introspection Query to the endpoint.
- It parses the returned schema, extracting all available `Object Types` and their respective `Fields`.

### 2. Data Sampling & Calculation

- The user selects which specific GraphQL types they want to analyze.
- The app dynamically constructs GraphQL queries to fetch a configurable sample size (e.g., 50, 100, 500, or 1000 records) for each selected type.
- Once the sample data is retrieved, the app calculates the **Density Score** for every field.
  - _Formula:_ `(Number of non-null/non-empty values / Total sampled records) * 100`
- It also calculates an **Overall Quality Score**, representing the average density across all selected fields.

### 3. Visualization & Interaction

- The calculated density data is fed into the visualization engine.
- **Heatmap View (D3.js):** Renders a matrix where rows are GraphQL Types and columns are Fields. The color intensity of each cell represents the density (e.g., Red = 0%, Yellow = 50%, Green = 100%).
- **Alternative Views (Recharts):** Users can toggle to a Bar Chart (ranking fields by density) or a Treemap (showing hierarchical density).
- **Drill-down:** Clicking on any cell reveals the raw data distribution, showing the top 10 most common values for that specific field.

## ✨ Key Features

- **🔌 Live GraphQL Integration:** Connects directly to any standard GraphQL API.
- **🗺️ Interactive D3.js Heatmap:** Features smooth panning, zooming, and detailed tooltips.
- **📊 Multiple View Modes:** Switch between Heatmap, Bar Chart, and Treemap visualizations.
- **🔍 Advanced Filtering:** Search for specific fields or filter out fields below a certain density threshold using a slider.
- **📥 Robust Exporting:** Export your visualizations and data in multiple formats:
  - **CSV:** Raw data export using Blob URLs for safe handling of special characters.
  - **PNG & PDF:** High-resolution image and document exports powered by `html-to-image` and `jsPDF`.
  - **SVG:** Direct vector export of the D3 heatmap.
- **🎨 Customization:** Fully customizable heatmap color scales, dark/light mode support, and configurable auto-refresh intervals.
- **💾 Workspace Persistence:** Endpoint URLs, headers, and UI preferences are saved locally using Zustand's persist middleware.

## 🛠️ Tech Stack

- **Frontend Framework:** React 18 with TypeScript
- **Routing:** React Router DOM
- **State Management:** Zustand (with persistence)
- **Styling:** Tailwind CSS & shadcn/ui components
- **Icons:** Lucide React
- **Visualizations:**
  - D3.js (for the complex, zoomable Heatmap matrix)
  - Recharts (for Bar Charts, Treemaps, and Distribution Pie Charts)
- **Export Utilities:** `html-to-image` (DOM to PNG/Canvas) and `jspdf` (PDF generation)

## 🚀 Getting Started

1. **Connect:** Navigate to the Dashboard (`/`) and enter your GraphQL endpoint.
2. **Select Schema:** Go to the Schema Explorer (`/schema`) and select the types you want to analyze.
3. **Visualize:** Open the Heatmap View (`/heatmap`) to see your data density. Use the toolbar to filter, switch views, or export your results.
4. **Settings:** Click the Settings gear in the sidebar to adjust sample sizes, theme, and heatmap colors.

---

_Built with precision to make data quality analysis effortless and visually intuitive._
