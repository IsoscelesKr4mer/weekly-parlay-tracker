# 🏈 Fantasy Football Parlay Tracker

A collaborative web application for tracking weekly fantasy football parlay picks with real-time updates, leaderboards, and comprehensive betting analytics.

## ✨ Features

### 🎯 Core Functionality
- **Weekly Pick Management**: Add, edit, and track parlay picks for each NFL week
- **Real-time Collaboration**: Multiple users can contribute picks simultaneously
- **Dynamic Betting**: Adjustable bet amounts and automatic payout calculations
- **Week Locking**: Prevent changes to picks after games start
- **Audit Trail**: Complete history of all changes and modifications

### 📊 Analytics & Tracking
- **Parlay Summary**: Real-time odds and payout calculations
- **Leaderboard**: Track individual performance across the season
- **Betting Breakdown**: Tax calculations and per-person winnings
- **Historical Data**: View past weeks and performance trends

### 🔧 Admin Features
- **Draft System**: Save and restore pick configurations
- **Data Management**: Clear picks, reset leaderboards, debug tools
- **Password Protection**: Secure week locking with admin controls

## 🚀 Live Demo

Visit the live application: [Your GitHub Pages URL]

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase Realtime Database
- **Hosting**: GitHub Pages
- **Styling**: Custom CSS with responsive design

## 📱 Responsive Design

The application is fully responsive and works seamlessly on:
- Desktop computers
- Tablets
- Mobile phones

## 🎮 How to Use

### For Players
1. **Select Week**: Choose the current NFL week from the dropdown
2. **Add Picks**: Click on empty slots to add your parlay picks
3. **Set Bet Amount**: Adjust the weekly bet amount as needed
4. **View Results**: Check the Parlay Summary tab for odds and payouts
5. **Track Performance**: Monitor your stats on the Leaderboard

### For Admins
1. **Lock Weeks**: Use the lock button to prevent changes after games start
2. **Manage Data**: Access admin tools for data management
3. **Save Drafts**: Create backup configurations of picks
4. **Audit Log**: Review all changes and modifications

## 🔧 Setup Instructions

### Prerequisites
- A GitHub account
- A Firebase account (for real-time data)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/weekly-parlay-tracker.git
cd weekly-parlay-tracker
```

### 2. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Realtime Database
4. Copy your Firebase configuration
5. Update the `firebaseConfig` object in `app.js`

### 3. Deploy to GitHub Pages
1. Push your code to GitHub
2. Go to repository Settings
3. Navigate to Pages section
4. Select source branch (usually `main`)
5. Your site will be available at `https://yourusername.github.io/weekly-parlay-tracker`

## 📁 Project Structure

```
weekly-parlay-tracker/
├── index.html          # Main HTML file
├── app.js             # JavaScript application logic
├── styles.css         # CSS styling
├── README.md          # Project documentation
└── CNAME              # Custom domain configuration (optional)
```

## 🔐 Security Features

- **Password Protection**: Week locking requires admin password
- **Data Validation**: Input sanitization and validation
- **Audit Logging**: Complete change tracking
- **Backup System**: Automatic data backups before major changes

## 🎯 NFL Season Integration

The application automatically calculates the current NFL week based on:
- Season start date (September 4, 2025)
- NFL week structure (Tuesday to Monday)
- Real-time date calculations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/yourusername/weekly-parlay-tracker/issues) page
2. Create a new issue with detailed information
3. Include screenshots if applicable

## 🎉 Acknowledgments

- Built for fantasy football enthusiasts
- Designed for collaborative parlay tracking
- Optimized for real-time updates and mobile use

---

**Happy Betting! 🏈💰**
