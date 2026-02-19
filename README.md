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

## 📦 Deployment on Vercel

The easiest way to deploy this app is to use the [Vercel Platform](https://vercel.com/new).

1.  **Push to GitHub**: Ensure your latest code is on GitHub.
2.  **Import Project**: Go to Vercel, click "Add New...", and select "Project".
3.  **Select Repository**: Choose `tb` (or your repo name).
4.  **Configure**:
    - **Framework Preset**: Next.js (should be auto-detected)
    - **Build Command**: `next build`
    - **Install Command**: `npm install`
    - **Environment Variables**: None required for basic functionality.
5.  **Deploy**: Click "Deploy".

### Note on API Rate Limits
This app uses public APIs (`yahoo-finance2`). Vercel's serverless functions share IP addresses. Heavy usage might trigger rate limits from Yahoo. For production, consider using a dedicated trading API provider if you experience issues.

## 🏃‍♂️ Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```
