# SmartOmica MIS - Medical Document Translation Platform

A React Router v7 application for AI-powered medical document translation and processing using Langfuse, OpenRouter, and Minio storage.

## Features

- **AI-Powered Translation**: Medical document translation using OpenAI models via OpenRouter
- **Multiple Processing Modes**: Translation, summarization, and OCR
- **Multi-Language Support**: English, Russian, Spanish, Hebrew, Arabic
- **File Storage**: Secure file storage using Minio
- **Observability**: Full tracing and monitoring with Langfuse
- **Modern UI**: Clean, responsive interface using TailwindCSS
- **Authentication**: Simple session-based auth (ready for OAuth integration)

## Tech Stack

- **Frontend**: React Router v7, TypeScript, TailwindCSS
- **AI/LLM**: OpenRouter (OpenAI GPT-4), Langfuse for observability
- **Storage**: Minio S3-compatible object storage
- **Authentication**: Cookie-based sessions (hardcoded accounts for demo)

## Quick Start

### 1. Environment Setup

Copy the example environment file:
```bash
cp .env.example .env
```

Update `.env` with your credentials:
```env
# Langfuse Configuration
LANGFUSE_BASE_URL=https://cloud.langfuse.com
LANGFUSE_PUBLIC_KEY=pk-lf-your-key
LANGFUSE_SECRET_KEY=sk-lf-your-secret

# OpenRouter Configuration  
OPENROUTER_API_KEY=sk-or-your-key

# Minio Configuration
MINIO_ENDPOINT=https://minio.smartomica.org
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET=smartomica-mis

# Session Configuration
SESSION_SECRET=your-session-secret-key
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

## Demo Accounts

For testing, use these hardcoded accounts:

- **Admin**: `admin@smartomica.org` / `admin123`
- **User**: `user@smartomica.org` / `user123`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run typecheck` - Run TypeScript checks

## Project Structure

```
app/
├── components/          # Reusable UI components
│   ├── Layout.tsx      # Main layout with navigation
│   └── FileUpload.tsx  # Drag-drop file upload
├── lib/                # Business logic and utilities
│   ├── auth/           # Authentication (session management)
│   ├── i18n/           # Internationalization
│   ├── services/       # Document processing service
│   ├── storage/        # Minio integration
│   └── langfuse.server.ts # Langfuse/OpenRouter integration
├── routes/             # React Router routes
│   ├── home.tsx        # Landing page
│   ├── login.tsx       # Authentication
│   ├── dashboard.tsx   # User dashboard
│   └── documents/      # Document management
├── types/              # TypeScript type definitions
└── env.server.ts       # Environment configuration
```

## Features Overview

### Document Upload & Processing
- Drag-drop file upload for multiple file types (PDF, DOCX, images)
- Language selection (auto-detect source, manual target)
- Processing modes: Translation, Summarization, OCR
- Real-time progress tracking

### AI Integration
- **OpenRouter**: Access to OpenAI GPT-4 for processing
- **Langfuse**: Prompt management, tracing, and observability
- **Configurable prompts**: Stored in Langfuse for easy updates

### File Storage
- **Minio**: S3-compatible object storage for documents and results
- **Presigned URLs**: Secure file access
- **File organization**: Per-user, per-job folder structure

### User Interface
- **Responsive design**: Works on desktop and mobile
- **TailwindCSS**: Utility-first CSS framework
- **Clean dashboard**: Stats, recent documents, quick actions
- **Document management**: Upload, view status, download results

## Development Notes

### Authentication
Currently uses hardcoded accounts for demo purposes. To implement OAuth:

1. Replace `app/lib/auth/session.server.ts` with OAuth provider integration
2. Update route loaders to handle OAuth callbacks
3. Modify user type definitions as needed

### Data Storage
The application currently simulates a database with in-memory data. For production:

1. Add a database (PostgreSQL, MongoDB, etc.)
2. Create document and job models
3. Update loaders/actions to use database queries
4. Add data migration scripts

### File Processing
The document processor currently uses placeholder text extraction. For production:

1. Implement proper OCR using libraries like pdf2pic, tesseract
2. Add document format converters
3. Enhance error handling and retry logic
4. Add batch processing queues

### Observability
Langfuse integration provides:
- **Trace collection**: All AI interactions are automatically traced
- **Prompt management**: Store and version control prompts
- **Performance monitoring**: Track costs, latency, accuracy
- **Error tracking**: Capture and analyze failures

## Deployment

### Environment Variables
Ensure all production environment variables are set:
- Use strong session secret
- Configure production Minio bucket
- Set up production Langfuse project
- Use production OpenRouter key

### Build for Production
```bash
npm run build
npm run start
```

### Docker Deployment
The app can be containerized and deployed to any platform supporting Node.js applications.

## Contributing

1. Follow the existing code patterns
2. Use TypeScript for all new code
3. Add proper error handling
4. Test document upload/processing flows
5. Update README for any new features

## License

Private - SmartOmica Internal Use