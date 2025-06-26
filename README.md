# Souros - A Web-Based Desktop Environment

Souros is a simple, lightweight web-based desktop environment built with Node.js and Express. It simulates a basic operating system in your browser, complete with a file system, applications, and a taskbar.

## Features

*   A graphical user interface (GUI) with a desktop, windows, and a taskbar.
*   Core applications:
    *   **File Explorer:** Browse files and folders.
    *   **Text Editor:** Create and edit text files.
    *   **Browser:** A simple web browser.
*   A simulated file system using local storage.

## Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) installed on your system.

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd souros
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```

### Running the Application

To start the server, run the following command:

```bash
npm start
```

Then, open your web browser and navigate to `http://localhost:3000` (or the port specified in the server configuration).

## Technologies Used

*   **Backend:** Node.js, Express
*   **Frontend:** HTML, CSS, JavaScript
*   **Dependencies:**
    *   `axios`: For making HTTP requests.
    *   `express`: Web framework for Node.js.