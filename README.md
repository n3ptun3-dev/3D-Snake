# 3D Snake 🐍

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

**The classic snake game, reimagined in a dynamic 3D world from the snake's first-person perspective.**

![3D Snake Banner](https://raw.githubusercontent.com/n3ptun3-dev/assets/refs/heads/main/images/Snake%20banner.jpg)

## 🎮 Play the Game

Experience the thrill of 3D Snake live in your browser!

**[➡️ Play Now!](https://your-live-url.com)** _(Replace with your game's URL)_

---

## ✨ Features

3D Snake goes beyond the classic grid-based game, introducing a rich, interactive environment with numerous features:

*   **Immersive 3D Gameplay:** Navigate a neon-drenched cityscape from a first-person or dynamic third-person perspective.
*   **Multiple Camera Views:** Switch between First Person, Orbit, and two cinematic Drone views to see the action from every angle.
*   **Procedurally Generated Levels:** Every game features a unique, dynamically generated city layout with different building heights, passages, and ad placements, ensuring no two rounds are the same.
*   **Dynamic Power-Ups:** Collect a variety of "Energy Nodes" to gain strategic advantages:
    *   🍎 **Data Node:** The classic apple. Increases score, speed, and length.
    *   ⚡ **Overdrive Node:** A temporary, high-speed boost.
    *   🐢 **Stasis Node:** Instantly reduces your base speed.
    *   🧲 **Tractor Node:** Pulls nearby Data Nodes towards you.
    *   **2️⃣ Multiplier Node:** Doubles your score per Data Node.
    *   **3️⃣ Fork Node:** Triples your growth and points per Data Node.
    *   ❤️ **Aegis Node:** A rare item that grants an extra life.
*   **Interactive Environment:** Navigate through portals, explore hidden alcoves, and race down street passages that cut through the city blocks.
*   **Competitive Leaderboards:** Compete for the top spot on separate leaderboards for mobile and desktop players, powered by Google Sheets.
*   **Pi Network Integration:** Authenticate with your Pi account to submit scores and purchase in-game ad space using Pi cryptocurrency.
*   **In-Game Advertising System (AMI):** A complete, self-serve portal for players to purchase and schedule their own ads (billboards, posters, banners) to be displayed in everyone's game.
*   **Live Radio Player:** Tune in to thousands of online radio stations from around the world to customize your gameplay soundtrack.
*   **Adjustable Graphics Quality:** Choose between High, Medium, and Low settings to optimize performance for your device.

---

## 🛠️ Technology Stack

This project is built with a modern, high-performance web stack:

*   **Frontend:** [React](https://reactjs.org/), [TypeScript](https://www.typescriptlang.org/)
*   **3D Rendering:** [Three.js](https://threejs.org/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Backend & Hosting:** [Firebase](https://firebase.google.com/) (Hosting, Cloud Functions, Firestore for game config)
*   **Build Tool:** [esbuild](https://esbuild.github.io/)

---

## 🚀 Getting Started

To run the project locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/3d-snake.git
    cd 3d-snake
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the project:**
    The project uses `esbuild` for a fast and simple build process.
    ```bash
    npm run build
    ```
    This command will compile the TypeScript/React code, process styles, and place all static assets into the `dist` directory.

4.  **Serve the application:**
    There is no built-in development server. You can use any static file server to run the app locally. A simple option is the `serve` package.
    ```bash
    # If you don't have serve installed: npm install -g serve
    serve -s dist
    ```
    The application will be available at `http://localhost:3000` (or the port specified by `serve`).

---

## 📂 Project Structure

The codebase is organized to separate concerns, making it easier to navigate and contribute.

```
.
├── audio/            # All game sound effects and music loops
├── components/       # Reusable React components (UI, overlays, 3D board)
├── public/           # Static assets for the build output (index.html, etc.)
├── utils/            # Helper functions and services (Pi SDK, leaderboard, game config)
├── App.tsx           # Main application component, handles game state and logic
├── constants.ts      # Game constants (colors, board size, etc.)
├── index.html        # Main HTML file for the development environment
├── index.tsx         # Application entry point
├── package.json      # Project dependencies and scripts
└── types.ts          # TypeScript type definitions for the entire application
```

---

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features, bug fixes, or improvements, please feel free to:

1.  **Fork** the repository.
2.  Create a new **branch** (`git checkout -b feature/your-feature-name`).
3.  Make your changes and **commit** them (`git commit -m 'Add some feature'`).
4.  **Push** to the branch (`git push origin feature/your-feature-name`).
5.  Open a **Pull Request**.

Please ensure your code follows the existing style and that your changes are well-documented.

---

## 📜 License

This project is licensed under the **Pi Open Source (PiOS) License**. See the [LICENSE](LICENSE) file for the full license text.

*Pi, Pi Network and the Pi logo are trademarks of the Pi Community Company.*
