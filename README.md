# 🚀 Telegram Hub

A beautiful, full-stack web application to access all your Telegram groups (public & private) in one place — with video playback and sound.

![Architecture](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=flat-square) ![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?style=flat-square) ![Deploy](https://img.shields.io/badge/Deploy-Vercel%20%2B%20Render-000?style=flat-square)

---

## 📋 Prerequisites

1. **Node.js** (v18+) installed on your machine
2. A **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)

### How to Get Your Bot Token

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Follow the prompts to name your bot
4. Copy the **Bot Token** (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. **Add the bot to each group** you want to display on the website
6. **Make the bot an admin** in each group (so it can read messages)

---

## 🗂️ Project Structure

```
Telegram/
├── backend/              ← Node.js + Express (Deploy to Render)
│   ├── server.js
│   ├── config/groups.js  ← ⚙️ Configure your groups here
│   ├── routes/
│   │   ├── groups.js
│   │   ├── messages.js
│   │   └── media.js
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
│
├── frontend/             ← React + Vite (Deploy to Vercel)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── index.css
│   │   ├── main.jsx
│   │   └── components/
│   │       ├── Header.jsx
│   │       ├── GroupList.jsx
│   │       ├── MessageFeed.jsx
│   │       └── VideoPlayer.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── vercel.json
│   └── package.json
│
└── README.md             ← You are here
```

---

## 🚀 Quick Start (Local Development)

### 1. Setup Backend

```bash
cd backend

# Create your .env file
cp .env.example .env
# Edit .env and paste your BOT_TOKEN

# Install dependencies
npm install

# Start the backend
npm run dev
```

The backend will start on `http://localhost:3001`.

### 2. Configure Your Groups

Edit `backend/config/groups.js` and add your actual Telegram group IDs:

```js
module.exports = [
  {
    id: "-1001234567890",       // Your group's chat ID
    name: "My Awesome Group",
    description: "Description of the group",
    type: "public",             // "public" or "private"
    invite_link: "https://t.me/mygroup"  // or null for private
  },
  // Add more groups...
];
```

> **💡 How to find your group's Chat ID:**
> 1. Add [@RawDataBot](https://t.me/RawDataBot) to your group
> 2. It will send a message with the chat info — copy the `chat.id` value
> 3. Remove the bot afterward

### 3. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the frontend
npm run dev
```

The frontend will start on `http://localhost:5173` and proxy API calls to the backend.

---

## 🌐 Deployment

### Deploy Backend to Render

1. Push your code to **GitHub**
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Set:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add **Environment Variable:**
   - `BOT_TOKEN` = your bot token
   - `FRONTEND_URL` = your Vercel URL (e.g., `https://your-app.vercel.app`)
6. Deploy!
7. Copy your Render URL (e.g., `https://telegram-hub-backend.onrender.com`)

### Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repo
3. Set:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
4. Edit `frontend/vercel.json` — replace the placeholder URL with your actual Render backend URL:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://YOUR-RENDER-URL.onrender.com/api/:path*"
       }
     ]
   }
   ```
5. Deploy!

---

## ⚠️ Important Notes

- **Render Free Tier:** Spins down after 15 min of inactivity. First visit after idle takes ~30s to wake up.
- **Bot API Limitation:** Telegram's Bot API can only receive *new* messages (not historical ones). The backend polls for new messages and stores the last 100 per group in memory.
- **Private Videos:** Videos from private groups are streamed through your backend server, so they play directly on the website with sound.
- **Security:** Your backend is publicly accessible. Anyone with the URL can see your group messages. If you need password protection, consider adding a simple auth layer.

---

## 📄 License

MIT
