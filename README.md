# AyaLearning 

My personal space for picking up Japanese :3

## Features

- Add,fix, delete search, and view Kanji and Vocabulary.
- Take quizzes to test your knowledge.
- Pagination for large lists.
- ChatBot assistant for interactive help.
- Responsive UI with Tailwind CSS.

## Getting Started

### Prerequisites

- Node.js (v14+ recommended)
- npm or yarn
- Git (latest version recommended)

### Installation

**Option 1: Fix SSL Certificate Issue (Recommended)**

1. Update Git to latest version:
   ```bash
   git --version
   # If older than 2.30, update Git
   ```

2. Configure Git SSL settings:
   ```bash
   git config --global http.sslBackend schannel
   # Or alternatively:
   git config --global http.sslverify false
   ```

3. Clone the repository:
   ```bash
   git clone https://github.com/aya1101/AyaLearning.git
   cd AyaLearning/frontend
   ```

**Option 2: Use SSH Instead of HTTPS**

1. Set up SSH key for GitHub (if not already done)
2. Clone using SSH:
   ```bash
   git clone git@github.com:aya1101/AyaLearning.git
   cd AyaLearning/frontend
   ```

**Option 3: Download ZIP**

1. Go to GitHub repository page
2. Click "Code" → "Download ZIP"
3. Extract and navigate to project folder

### After Installation

4. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

5. Start the development server:
   ```bash
   npm start
   # or
   yarn start
   ```

6. Make sure the backend server is running at `http://localhost:3001`.

### Troubleshooting Git SSL Issues

If you continue having SSL issues:

```bash
# Temporary fix (not recommended for production)
git config --global http.sslverify false

# Better fix - update certificates
git config --global http.sslCAinfo "path/to/ca-bundle.crt"

# Reset to default
git config --global --unset http.sslverify
```

### Project Structure

- `src/App.js`: Main React component, contains all logic and UI.
- `src/components/ChatBot.js`: ChatBot component.
- `public/`: Static assets (logo, GIFs, etc.)

## Usage

- Select "Học Kanji" or "Học Từ Vựng" to manage Kanji or Vocabulary.
- Use the search bar to filter items.
- Add new Kanji or Vocabulary using the forms.
- Start a quiz to test your knowledge.
- View your score and feedback GIF after each quiz.
- Use the Tutor ChatBot for help or conversation.

## Customization

- Update GIFs and images in the `public/` folder.
- Modify quiz logic or UI in `src/App.js`.

