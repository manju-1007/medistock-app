# MediStock — Medicine Inventory & Stock Manager

A responsive web application for managing **Present Stock** and **New Stock** in a pharmacy or medical store, with user login, instant availability search, bulk upload, PDF/CSV export, and optional Firebase Cloud Sync.

## Project Structure

- `index.html` — Main application layout and modals
- `style.css` — Custom styling and toast animations
- `app.js` — Application state, authentication, search, upload, PDF export, and Firebase sync logic
- `README.md` — Project documentation

## Key Features

1. **User Authentication**: Login and Create Account screens with per-user stock storage (`demo` / `1234` included for quick demo).
2. **Present Stock vs. New Stock Search**: Toggle between **All Stock**, **Present Stock**, and **New Stock** to check availability before adding new stock.
3. **Live Pre-Add Check**: Typing a medicine name in the Add modal automatically checks if it already exists in Present Stock.
4. **Add, Edit, Restock & Delete**: Full CRUD operations with quick `+1` / `-1` quantity controls and `+ Stock` restock modal.
5. **Anytime Upload**: Upload CSV/JSON files (with drag-and-drop) or paste a medicine list line by line.
6. **Export PDF & CSV**: Download a formatted PDF stock report or CSV backup anytime.
7. **Firebase Cloud Sync**: Connect a Firebase Realtime Database URL in the UI or set `DEFAULT_FIREBASE_URL` in `app.js`.

## How to Run in Visual Studio Code

1. Extract this folder and open `MediStock-Project` in **Visual Studio Code**.
2. Install the **Live Server** extension in VS Code.
3. Right-click `index.html` and select **Open with Live Server**.
