# Praan - Personalized Healthy Recipe Generator

> **Your Health, Your Recipes, Your Way**

A full-stack Node.js, Express, and MongoDB web app with a React 19 + Vite frontend and an existing Node.js backend designed for health-conscious users seeking personalized, nutritious recipes tailored to their medical conditions, dietary preferences, and lifestyle needs.

## 🎯 Features

### Authentication & User Management

- JWT-based authentication (Signup/Login)
- Secure password hashing with bcryptjs
- User profile management with health preferences
- Protected routes

### Personalized Recipe Generation

- Dynamic recipe generator based on:
  - Health conditions (Diabetes, Cholesterol, PCOD, Anaemia, Thyroid)
  - Dietary preferences (Veg, Non-Veg, Vegan, etc.)
  - Allergies & deficiencies
  - Cuisine & cooking time preferences
  - Health profile (Age, Weight, Height, Gender)
- **Max 5 API calls/day** (optimized quota management)
- 1-hour caching for generated recipes

### Recipe Discovery

- Browse healthy recipes from pre-seeded database
- Advanced filtering system
- Nutrition information
- Embedded YouTube cooking tutorials (7-day cache)
- Save/favorite recipes
- Rate limiting & security headers

### Performance & Caching

- 7-day browser cache for browsing results
- 24-hour cache for generated recipes
- Database-first architecture to minimize API calls
- ~11 API calls/day (vs. 160+ in previous system)

## 🛠️ Tech Stack

**Frontend:** React 19, Vite, React Router, CSS3  
**Backend:** Node.js, Express.js  
**Database:** MongoDB  
**APIs:** Spoonacular, YouTube Data API  
**Security:** JWT, bcryptjs, express-validator, rate limiting, CORS, Helmet

## 📦 Folder Structure

```
praan/
├── client/                    # Frontend
│   ├── index.html             # React host page
│   ├── css/styles.css
│   ├── package.json           # Vite + React frontend scripts
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx            # React router shell
│   │   └── main.jsx           # React entry point
│   ├── js/
│   │   ├── app.js            # Main app logic
│   │   ├── cacheService.js   # Client-side caching
│   │   └── recipeCache.js    # Recipe cache management
│   └── assets/
├── server/                    # Backend
│   ├── server.js             # Entry point
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── recipeController.js
│   │   ├── optimizedRecipeController.js
│   │   └── userController.js
│   ├── models/
│   │   ├── User.js
│   │   ├── SavedRecipe.js
│   │   ├── Recipe.js
│   │   ├── GeneratedRecipeCache.js
│   │   ├── ApiRequestCounter.js
│   │   └── SeedingStatus.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── recipes.js
│   │   ├── optimizedRecipes.js
│   │   └── users.js
│   ├── services/
│   │   ├── spoonacularService.js
│   │   ├── youtubeService.js
│   │   └── optimizedRecipeService.js
│   ├── middlewares/
│   │   ├── auth.js
│   │   ├── rateLimit.js
│   │   └── validation.js
│   ├── utils/
│   │   ├── cacheService.js
│   │   ├── quotaService.js
│   │   └── tokenUtils.js
│   └── data/
│       └── quota-tracking.json
└── package.json
```

> Note: The React migration is in progress. The legacy vanilla JS files are still present for reference during the transition, but the active frontend entry is now React/Vite.

---

## ⚡ Quick Start (5 minutes)

### 1. Install Dependencies

```bash
npm install
cd server && npm install
cd ..
cd client && npm install
cd ..
```

### 2. Setup Environment Variables

Copy `.env.example` to `.env` in the project root, then fill in your local values:

```bash
copy .env.example .env
```

```env
# Server
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/praan

# API Keys (get from their respective sites)
SPOONACULAR_API_KEY=your_key_here
YOUTUBE_API_KEY=your_key_here

# JWT Secret
JWT_SECRET=your_secret_here
```

**Get API Keys:**

- Spoonacular: https://spoonacular.com/food-api (Free: 150 requests/day)
- YouTube: https://developers.google.com/youtube/v3 (Free: 10,000 units/day)

### 3. Setup MongoDB

**Local:**

```bash
mongod
```

**Or use MongoDB Atlas (cloud):**

- Create free cluster at https://www.mongodb.com/cloud/atlas
- Copy connection string to `MONGODB_URI` in `.env`

### 4. Start the Application

```bash
npm run dev
```

This starts the Express backend and the React Vite frontend together.

Open the React app at `http://localhost:3000` and the backend at `http://localhost:5000`.

If you want to run them separately:

```bash
npm start
cd client && npm run dev
```

The root `npm run build` command now builds the React client.

---

## 🏗️ System Architecture

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION (React Frontend)                │
│  React Router pages | Browse Recipes | Generate | Profile           │
└──────────────────────┬────────────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────────────┐
│                    API LAYER (Express Routes)                      │
│  GET /recipes/healthy (DB)  |  POST /recipes/generate (API limit) │
└──────────────────────┬────────────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────────────┐
│                    SERVICE LAYER (Business Logic)                  │
│  Recipe Service | Cache Service | Quota Service                   │
└──────────────────────┬────────────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────────────┐
│                    DATA LAYER (MongoDB)                             │
│  Recipes | Users | Saved Recipes | Generated Cache | Request Count │
└─────────────────────────────────────────────────────────────────────┘
```

### API Usage Strategy

| Feature         | Source          | Limit            | Cache  |
| --------------- | --------------- | ---------------- | ------ |
| Browse Recipes  | Database        | Unlimited        | 7 days |
| Generate Recipe | Spoonacular API | 5/day            | 1 hour |
| YouTube Videos  | YouTube API     | 10,000 units/day | 7 days |

**Daily API Calls:** ~11 (seed: 1, generations: 5, videos: 5)

### React Frontend Routes

- `/` - Main recipe generator shell
- `/discover` - Healthy recipe discovery
- `/profile` - User profile and saved recipes

---

## 🔐 API Endpoints

### Authentication

```
POST   /api/auth/register            # User registration
POST   /api/auth/login               # User login
GET    /api/auth/me                  # Get current user profile
GET    /api/auth/logout              # User logout
```

### Recipes

```
GET    /api/recipes/healthy          # Browse healthy recipes
POST   /api/recipes/generate         # Generate personalized recipe
GET    /api/recipes/:id              # Get recipe details
POST   /api/recipes/save             # Save favorite recipe
GET    /api/recipes/saved            # Get saved recipes
GET    /api/recipes/quota-status     # Check API quota remaining
```

### Users

```
GET    /api/users/profile            # Get user profile
PUT    /api/users/profile            # Update user profile
PUT    /api/users/preferences        # Update preferences
DELETE /api/users/profile            # Delete user profile
```

---

## 📊 Caching Strategy

### Client-Side Caching (localStorage)

- **Browse Results:** 7 days TTL
- **Generated Recipes:** 24 hours TTL
- **API Requests:** 1 hour TTL

### Server-Side Caching

- **Recipe Search:** 30 minutes
- **Generated Recipes:** 1 hour
- **YouTube Videos:** 7 days

---

## 🚀 API Integration Details

### Spoonacular API

- **Purpose:** Recipe data, nutrition info
- **Quota:** 150 points/day (free tier)
- **Usage:** Seeding (1 call on startup), Generation (1-5 calls/day based on user)
- **File:** `server/services/spoonacularService.js`

### YouTube Data API

- **Purpose:** Cooking video links
- **Quota:** 10,000 units/day
- **Usage:** On-demand when user clicks "Watch Tutorial"
- **File:** `server/services/youtubeService.js`
- **Cache:** 7 days per recipe

### Quota Management

- **File:** `server/utils/quotaService.js`
- **Tracking:** Daily reset at midnight
- **Fallback:** Database recipes if API quota exhausted

---

## 🔧 Development

### Running Tests

```bash
cd server
npm test
```

### Database Seeding

Recipes are auto-seeded on first startup from Spoonacular API.

### Frontend Development

- React frontend entry: `client/index.html`
- React root: `client/src/main.jsx`
- App shell and routing: `client/src/App.jsx`
- Shared styles: `client/css/styles.css`

### Common Issues

**MongoDB Connection Failed**

- Ensure MongoDB is running: `mongod`
- Check `MONGODB_URI` in `.env`

**API Key Invalid**

- Verify keys from respective API dashboards
- Ensure no extra spaces in `.env`

**Rate Limit Exceeded**

- API has daily limits; application auto-resets at midnight
- Check `/api/recipes/quota-status` for remaining quota

---

## ✅ Integration Verification

Run these checks after setup:

```bash
# 1) Start backend
npm run dev

# 2) In another terminal, verify health endpoint
curl "http://localhost:5000/api/health"

# 3) Open the frontend in the browser
#    http://localhost:3000
```

Expected results:

- Server starts without import errors
- React frontend loads through Vite
- `/api/recipes/quota-status` returns quota stats JSON
- `/api/recipes/healthy` returns recipe list successfully

---

## 📝 Environment Configuration

```env
# Required
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/praan
SPOONACULAR_API_KEY=
YOUTUBE_API_KEY=
JWT_SECRET=

# Optional
CACHE_TTL=86400
MAX_DAILY_API_CALLS=5
SPOONACULAR_DAILY_QUOTA=5
YOUTUBE_DAILY_QUOTA=10000
ENABLE_QUOTA_MONITORING=false
```

### Current Frontend Status

- React 19 and React Router are wired in the client app.
- The app is currently being migrated page by page from the legacy DOM-driven frontend.
- Existing caching helpers and backend API routes remain unchanged.

---

## 📄 License

MIT License - See LICENSE file for details
