# Swing Bot 2.1 (Pro)

A real-time trading dashboard built with Next.js 15, Tailwind CSS 4, and Yahoo Finance API.

## 🚀 Features

- **Real-time Data**: Live stock, crypto, and index prices.
- **Technical Analysis**: Auto-calculated SMA, RSI, MACD, and Bollinger Bands.
- **AI Sentiment**: News sentiment analysis (Bullish/Bearish).
- **Localization**: Full English (EN) and German (DE) support with auto-translation.
- **Responsive Design**: Glassmorphism UI that works on all devices.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4
- **Data**: `yahoo-finance2`
- **Translation**: `google-translate-api-x`
- **Charts**: `recharts`


### Note on API Rate Limits
This app uses public APIs (`yahoo-finance2`). Vercel's serverless functions share IP addresses. Heavy usage might trigger rate limits from Yahoo. For production, consider using a dedicated trading API provider if you experience issues.

## 🏃‍♂️ Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```
