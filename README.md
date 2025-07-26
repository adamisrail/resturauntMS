# Restaurant Management System

A modern React-based restaurant management system with real-time chat, gift functionality, and menu management.

## Features

- 🍽️ **Menu Management**: Browse and manage restaurant menu items
- 🎁 **Gift System**: Send gifts to other users in the chat
- 💬 **Real-time Chat**: Communicate with other users
- 🛒 **Shopping Cart**: Add items to cart with quantity management
- ❤️ **Wishlist**: Save favorite items for later
- 📱 **Responsive Design**: Works perfectly on all devices
- 🔥 **Firebase Integration**: Real-time data synchronization

## Tech Stack

- **Frontend**: React 18, CSS3
- **Backend**: Firebase (Firestore, Authentication)
- **Deployment**: Vercel
- **Styling**: Custom CSS with responsive design

## Deployment to Vercel

### Prerequisites

1. **GitHub Account**: Make sure your code is pushed to a GitHub repository
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **Firebase Project**: Your Firebase configuration is already set up

### Deployment Steps

#### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will automatically detect it's a React app

3. **Configure Build Settings**:
   - **Framework Preset**: Create React App
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

4. **Environment Variables** (if needed):
   - Your Firebase config is already hardcoded, so no environment variables are needed
   - If you want to use environment variables later, add them in the Vercel dashboard

5. **Deploy**:
   - Click "Deploy"
   - Vercel will build and deploy your app automatically

#### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Follow the prompts**:
   - Link to existing project or create new
   - Confirm build settings
   - Deploy

### Post-Deployment

1. **Custom Domain** (Optional):
   - In your Vercel dashboard, go to your project
   - Click "Settings" → "Domains"
   - Add your custom domain

2. **Environment Variables** (if needed):
   - Go to "Settings" → "Environment Variables"
   - Add any environment variables you need

3. **Automatic Deployments**:
   - Every push to your main branch will trigger a new deployment
   - Preview deployments are created for pull requests

## Local Development

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd restaurant-ms
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm start
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## Firebase Configuration

The app is already configured with Firebase. The configuration is in `src/firebase/config.js`:

- **Project ID**: testmenu-6f164
- **Database**: Firestore
- **Authentication**: Enabled
- **Storage**: Enabled

## Project Structure

```
src/
├── components/
│   ├── Admin/
│   ├── Auth/
│   ├── Chat/
│   ├── Navigation/
│   ├── Notifications/
│   └── Pages/
├── firebase/
│   └── config.js
├── utils/
├── App.js
├── App.css
├── index.js
└── index.css
```

## Features in Detail

### Menu System
- Grid, list, and compact layouts
- Search and filter functionality
- Category-based organization
- Real-time updates

### Gift System
- Send gifts to chat participants
- Prevent duplicate gifts
- Real-time synchronization
- Gift notifications

### Chat System
- Real-time messaging
- Typing indicators
- Message notifications
- Participant management

### Cart System
- Add/remove items
- Quantity management
- Gift item handling
- Price calculations

## Support

For deployment issues:
1. Check Vercel build logs
2. Ensure all dependencies are in `package.json`
3. Verify Firebase configuration
4. Check browser console for errors

## License

This project is private and proprietary. 