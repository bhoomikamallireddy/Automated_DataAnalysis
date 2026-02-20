# Automated Intelligent Data Analysis Platform 
 
An intelligent, end-to-end web application designed to automate the data science lifecycle. This platform allows users to upload raw CSV files and receive a comprehensive suite of automated Exploratory Data Analysis (EDA), Machine Learning (ML) insights, and natural-language summaries.
 
 
##  System Overview
The project utilizes a **Decoupled Asynchronous Architecture**. By separating the web server from the processing engine, the platform handles intensive computations (up to 50MB) without blocking the user interface or causing request timeouts.
 
### Key Features
- **Asynchronous Pipeline:** Heavy lifting is offloaded to background workers using Django Q.
- **Automated EDA:** Instant generation of descriptive statistics and correlation matrices.
- **ML Intelligence:** Automated feature importance ranking and PCA dimensionality reduction.
- **Insight Engine:** Heuristic-based reasoning that translates math into human-readable text.
- **Interactive Visuals:** Dynamic charting powered by Plotly.js.
 
##  Tech Stack
 
| Layer | Technology | Usage |
| :--- | :--- | :--- |
| **Frontend** | Next.js (React) | UI, Polling Logic, and Result Rendering |
| **Backend API** | Django | API Orchestration and File Management |
| **Task Queue** | Django Q | Background Task Management |
| **Database** | PostgreSQL | Job Tracking and JSONB Result Storage |
| **Data Science** | Pandas / NumPy | Data Auditing and Statistical Math |
| **AI Layer** | Scikit-Learn | Random Forest & PCA Algorithms |
| **Visualization** | Plotly.js | Interactive Data Mapping |
 
---
 
##  High-Level Architecture
 
The system flow follows a strict "Producer-Consumer" pattern:
 
1. **Upload:** Next.js streams the CSV to the Django API.
2. **Queue:** Django creates a Job record in PostgreSQL and enqueues a task in Django Q.
3. **Process:** The Django Q Worker picks up the task and runs the engine pipeline sequentially.
4. **Poll:** Next.js polls the Status API every 3–5 seconds to update the UI progress bar.
5. **Render:** Once completed, Next.js fetches the final JSONB blob and renders Plotly charts.
 
 
---
 
## 🔬 The Analysis Pipeline (Engines)
 
The Background Worker executes three specialized engines:
 
### 1. EDA Engine
* **Input:** Raw DataFrame.
* **Logic:** Calculates descriptive statistics, identifies null values, and generates a Pearson correlation matrix.
* **Output:** Statistical JSON summary.
 
### 2. ML Engine
* **Input:** Cleaned DataFrame.
* **Logic:** Trains a Random Forest to rank feature importance and executes PCA for 2D data projection.
* **Output:** Feature scores and $(x, y)$ coordinate arrays.
 
 
### 3. Insight Engine
* **Input:** EDA & ML Outputs.
* **Logic:** Applies conditional reasoning to identify significant trends (e.g., strong correlations or top data drivers).
* **Output:** Array of human-readable strings.
 
 
---
 
## 📋 Component Dependency Map
 
| Component | Depends On | Outcome |
| :--- | :--- | :--- |
| **Random Forest** | Pandas | Feature Importance Scores |
| **PCA** | Scikit-Learn | 2D Scatter Plot Coordinates |
| **JSONB Storage** | PostgreSQL | Persistent Result Storage |
| **Polling Hook** | React/Next.js | Real-time Progress Updates |
 
---
 
## 🚦 Getting Started
 
### Backend Setup
1. Navigate to `/backend`.
2. Install dependencies: `pip install -r requirements.txt`.
3. Run migrations: `python manage.py migrate`.
4. Start the worker: `python manage.py qcluster`.
5. Start the server: `python manage.py runserver`.
 
### Frontend Setup
1. Navigate to `/frontend`.
2. Install dependencies: `npm install`.
3. Start the dev server: `npm run dev`.
 
---