# Looki AI Dashboard

A comprehensive fashion industry dashboard powered by AI, featuring real-time trend analysis, intelligent chat capabilities, and advanced data visualization.

## Features

### 🎯 Core Functionality
- **Fashion Trend Analysis**: Real-time tracking and analysis of fashion trends
- **AI-Powered Chat**: Intelligent assistant with web search capabilities
- **Data Visualization**: Interactive charts and graphs for trend insights
- **User Authentication**: Secure login/signup with Supabase
- **File Processing**: Upload and analyze PDF/JSON files
- **Profile Management**: User profile customization and brand information
- **Automated Trend Scraping**: Trend scraping with Vercel Cron Jobs

### 🤖 AI Capabilities
- **Web Search Integration**: Real-time web search using Firecrawl API
- **Image Generation**: AI-powered fashion image creation with DALL-E 3
- **Context-Aware Chat**: Right-click context menus for seamless data interaction
- **Multi-file Analysis**: Process multiple files simultaneously
- **Chat Persistence**: Save and restore chat history across sessions

### 📊 Dashboard Components
- **Trend Signals**: Monitor emerging fashion trends
- **Catalog Matches**: AI-powered product matching
- **Inventory Actions**: Smart inventory management recommendations
- **Trend Forecasts**: Predictive analytics for fashion trends

## Tech Stack

- **Frontend**: Next.js 15.2.4, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Next.js API routes, Node.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI Services**: OpenAI (GPT-4, DALL-E 3)
- **Web Search**: Firecrawl API
- **File Processing**: pdf-parse for PDF analysis
- **State Management**: React Context
- **Deployment**: Vercel with Cron Jobs

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- OpenAI API key
- Firecrawl API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/anishkganesh/Looki.git
   cd Looki
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENAI_API_KEY=your_openai_api_key
   FIRECRAWL_API_KEY=your_firecrawl_api_key
   CRON_SECRET=your_cron_secret
   ```

4. **Database Setup**
   Set up your Supabase database with the required tables:
   - `usr` - User information and chat history
   - `trends` - Fashion trend data

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard page
│   ├── login/            # Authentication pages
│   ├── profile/          # User profile page
│   └── layout.tsx        # Root layout
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── chat-sidebar.tsx  # Chat interface
│   ├── data-table-trends.tsx # Trend data table
│   └── ...
├── lib/                  # Utility libraries
│   ├── global-chat-context.tsx # Chat state management
│   ├── supabase.ts       # Database client
│   └── ...
├── hooks/                # Custom React hooks
├── public/               # Static assets
└── ...
```

## Key Features Explained

### AI Chat System
- **Global State Management**: Chat persists across different views
- **Web Search Integration**: Real-time search with Firecrawl
- **File Upload Support**: Analyze PDFs and JSON files
- **Context Menu Integration**: Right-click any data to add to chat
- **Multi-session Support**: Save and load chat history

### Trend Analysis
- **Real-time Data**: Live trend monitoring and analysis
- **Interactive Tables**: Sortable, filterable trend data
- **Detailed Views**: Comprehensive trend information sheets
- **Watchlist Feature**: Save important trends for monitoring
- **Export Capabilities**: Download trend data as JSON

### User Experience
- **Responsive Design**: Works on desktop and mobile
- **Dark/Light Themes**: Theme toggle support
- **Sidebar Navigation**: Intuitive app navigation
- **Profile Management**: Customizable user profiles
- **Brand Integration**: Support for fashion brand information

## API Integration

### Web Search
Uses Firecrawl API for real-time web search capabilities, enabling the AI to access current fashion trends and information.

### Image Generation
Integrates with OpenAI's DALL-E 3 for generating fashion-related images based on trend descriptions.

### Database Operations
All data persistence handled through Supabase with real-time subscriptions for live updates.

## Deployment

### Production Build
```bash
npm run build
npm start
```

### Environment Variables
Ensure all required environment variables are set in your production environment.

### Database Migration
Set up Supabase tables according to the schema in your Supabase dashboard.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team.

## Acknowledgments

- Built with Next.js and React
- UI components from shadcn/ui
- Icons from Lucide React
- Database and auth by Supabase
- AI capabilities powered by OpenAI 

---
Last deployed: 2025-05-24T02:26:00Z 