# GrowEasy AI CSV Importer

An AI-powered CSV importer that intelligently extracts and maps lead information from different CSV formats into the GrowEasy CRM format.

## Features

- Drag and drop CSV file upload
- CSV data preview before AI processing
- Responsive table with horizontal and vertical scrolling
- AI-powered intelligent CRM field mapping
- Supports different CSV column names and structures
- Automatically skips records without email or mobile number
- Displays successfully imported and skipped records
- Shows total imported and total skipped records
- Handles multiple emails and mobile numbers

## Tech Stack

### Frontend
- Next.js
- TypeScript
- CSS

### Backend
- Node.js
- Express.js

### AI
- Google Gemini AI

## Project Structure

```text
Groweasy/
├── backend/
├── frontend/
├── .gitignore
└── README.md
```

## Setup Instructions

### Backend Setup

```bash
cd backend
npm install
npm start
```

Create a `.env` file inside the `backend` folder and add your AI API key.

```env
GEMINI_API_KEY=your_api_key_here
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open the application in your browser at:

`http://localhost:3000`

## How It Works

1. Upload a valid CSV file using drag and drop or the file picker.
2. Preview the uploaded CSV records.
3. Click the Confirm Import button.
4. The frontend sends the CSV to the backend API.
5. The backend parses the CSV and processes records using AI.
6. AI intelligently maps available CSV fields into GrowEasy CRM fields.
7. Parsed CRM records and skipped record statistics are displayed.

## CRM Fields

The application extracts the following CRM fields where available:

- created_at
- name
- email
- country_code
- mobile_without_country_code
- company
- city
- state
- country
- lead_owner
- crm_status
- crm_note
- data_source
- possession_time
- description

## Author

Nihar Kumar