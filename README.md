# Rift Deck

**Rift Deck** is a web platform for **League of Legends: Wild Rift** designed to help players analyze their performance, track matches, explore game data and make better decisions based on their own gameplay.

🌐 **Live:** [riftdeck.com.ar](https://www.riftdeck.com.ar)

---

## About the project

Rift Deck started as a personal project focused on combining my interest in gaming with software development.

The platform brings together player performance tracking, Wild Rift data and analytical tools in a single application. Since Wild Rift does not provide a public API for complete player match history, the application focuses on data manually registered by users and transforms it into useful statistics and insights.

The project has evolved from a simple game companion into a full web application with authentication, persistent data, analytics, public game information, SEO-friendly pages and AI-assisted build suggestions.

---

## Features

- **Player dashboard** with personal performance information
- **Match tracking** and manual game registration
- **Performance statistics** based on registered matches
- **Champion tier list**
- **Build calculator**
- **Saved build library**
- **AI-assisted build suggester**
- Champion, item and rune information
- Public champion pages optimized for search engines
- User authentication and profile management
- Protected and role-based application routes
- Responsive interface for desktop and mobile

---

## AI Build Suggester

Rift Deck includes an AI-assisted recommendation system that analyzes match context to suggest builds.

The system can take into account information such as:

- Selected champion
- Player role
- Allied team composition
- Enemy team composition
- Items
- Runes
- Summoner spells
- Situational game context

The frontend communicates with a **Supabase Edge Function**, which processes the request and returns a structured recommendation that is validated before being displayed to the user.

The objective is not simply to return a predefined build, but to generate recommendations adapted to the context of each game.

---

## Tech stack

### Frontend

- React 18
- Vite
- JavaScript / TypeScript tooling
- React Router
- Tailwind CSS
- TanStack Query
- Radix UI
- Recharts
- Framer Motion

### Backend & Data

- Supabase
- PostgreSQL
- Supabase Authentication
- Supabase Edge Functions

### Deployment & Infrastructure

- Vercel
- Git / GitHub
- Environment-based configuration

### SEO

The project includes:

- Pre-rendered public pages
- Dynamic sitemap generation
- Public champion routes
- Canonical URLs
- Open Graph metadata
- Search-engine-specific routing rules
- Protected application pages excluded from indexing

---

## Project structure

```text
Rift_Deck_app/
├── public/
├── scripts/
├── src/
│   ├── api/
│   ├── assets/
│   ├── components/
│   ├── constants/
│   ├── features/
│   │   └── buildV2/
│   ├── hooks/
│   ├── lib/
│   ├── pages/
│   ├── seo/
│   └── utils/
├── supabase/
├── test/
├── package.json
├── tailwind.config.js
├── vercel.json
└── vite.config.js
```

---

## Main application routes

```text
/                     Dashboard / Landing
/library              Saved builds
/tierlist             Champion tier list
/build-calculator     Build calculator
/matches              Match history
/stats                Player statistics
/suggester            AI build suggester
/profile              User profile
```

Rift Deck also exposes public SEO-oriented routes for:

```text
/campeones
/campeones/:champion
/objetos
/runas
```

---

## Running locally

### 1. Clone the repository

```bash
git clone https://github.com/AgusstinMelo/Rift_Deck_app.git
cd Rift_Deck_app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create an `.env.local` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Additional backend configuration may be required for Supabase Edge Functions.

### 4. Start the development server

```bash
npm run dev
```

---

## Available scripts

```bash
npm run dev
```

Starts the Vite development server.

```bash
npm run build
```

Generates the sitemap, builds the frontend, creates the SSR bundle and prerenders public routes.

```bash
npm run preview
```

Runs the production build locally.

```bash
npm run lint
```

Runs ESLint.

```bash
npm run typecheck
```

Runs TypeScript type checking.

```bash
npm run test:v2
```

Runs the Build V2 test suite.

---

## Product philosophy

Because Wild Rift does not expose a complete public player-history API, Rift Deck does not attempt to present manually registered data as a complete representation of a player's activity.

Instead, the platform focuses on:

- Making registered data useful and understandable
- Identifying trends rather than claiming causality
- Providing traceable statistics
- Comparing players primarily against their own previous performance
- Turning data into actionable gameplay decisions

---

## Development

Rift Deck is an actively evolving personal project.

Some of the areas explored during development include:

- Frontend architecture
- Authentication and authorization
- Relational data modelling
- API and Edge Function integration
- AI-assisted recommendations
- Data validation
- SEO and static prerendering
- Responsive UI development
- Testing and debugging
- Deployment and production maintenance

---

## Disclaimer

Rift Deck is an independent project and is not endorsed by Riot Games.

**League of Legends: Wild Rift** and all related assets are trademarks or registered trademarks of Riot Games, Inc.

---

## Author

Developed by **Agustín Melo**

GitHub: [@AgusstinMelo](https://github.com/AgusstinMelo)

Project: [riftdeck.com.ar](https://www.riftdeck.com.ar)