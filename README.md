# Polymarket Monitor (Global Risk Control Terminal)

A real-time visualization and monitoring dashboard for Polymarket prediction markets. This project aggregates data from Polymarket, categorizes events (Politics, Crypto, Sports, etc.), and visualizes them on an interactive global map with real-time probability tracking and anomaly detection.

## Features

- **Real-time Map Visualization**: 
  - Interactive Leaflet map displaying active markets.
  - Custom markers based on event categories (Politics, Crypto, Sports, etc.).
  - Clustering for high-density areas.
  - **Granular Categorization**: Detailed subcategories (e.g., Bitcoin, Ethereum, US Politics, Global Elections).

- **Advanced Data Analysis**:
  - **Probability Trends**: Mini charts in popups showing probability fluctuations over time.
  - **Detailed Popups**: View top outcomes and their current probabilities directly on the map.
  - **Anomaly Detection**: Special visual alerts (rotating diamond markers) for significant market movements or high-value opportunities.

- **User Interface**:
  - Dark mode themed UI.
  - Collapsible category legend.
  - Group-based filtering (e.g., filtering "Politics" shows US Politics, International Politics, etc.).
  - Responsive event cards list.

## Tech Stack

- **Frontend**: HTML5, CSS3 (Tailwind CSS), JavaScript (Vanilla).
- **Mapping**: Leaflet.js, Leaflet.markercluster.
- **Charts**: Chart.js.
- **Backend**: Node.js, Express.
- **Real-time Communication**: Socket.io.
- **Data Fetching**: Node-fetch (poller).

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/xumengke2025-sys/Polymarket-monitor.git
   cd Polymarket-monitor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   node server.js
   ```

4. **Access the application**
   Open your browser and navigate to `http://localhost:3000`.

## Project Structure

- `public/index.html`: Main frontend entry point containing map logic and UI.
- `server.js`: Express server handling API proxying and categorization logic.
- `monitor.js`: Background worker for fetching and processing Polymarket data.
- `utils/translator.js`: Helper for translating and mapping Polymarket tags to categories.

## Usage

- **Map Navigation**: Drag and zoom to explore markets globally.
- **Filtering**: Use the category tabs at the top or the legend on the bottom left to filter specific market types.
- **Market Details**: Click on any marker to see detailed probabilities and historical trends.
- **Alerts**: Watch for pulsing red markers indicating high-activity or anomalous markets.

## License

MIT
