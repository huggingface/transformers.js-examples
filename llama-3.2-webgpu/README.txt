# Llama 3.2 WebGPU Desktop Service

A desktop application built with Electron for running the Llama 3.2 WebGPU service.

## Features

- System tray integration for lightweight operation
- One-click web service launch
- Clean control interface
- Quick browser access support
- Built-in development server

## Screenshots

Control Interface:
![Control Interface](./doc/llama3.2-electron.png)

Main Application:
![Main Application](./doc/llama3.2-electron2.png)

## Prerequisites

- Node.js (v20.18.1 or higher)
- npm (v11.0.0 or higher)
- A WebGPU-compatible browser and graphics card

## Installation

```bash
# Clone the repository
git clone [repository-url]

# Navigate to project directory
cd llama-3.2-webgpu

# Install dependencies
npm install
```

## Development

```bash
# Start in development mode
npm run electron:dev
```

This will:
- Launch the Vite development server
- Start the Electron application
- Enable hot-reloading for development

## Building

```bash
# Build the application
npm run build

# Package the application
npm run make
```

The packaged application will be available in the `out` directory.

## Usage

1. After launching, the application will appear in your system tray
2. Through the system tray icon, you can:
   - Open the control interface
   - Exit the application
3. The control interface allows you to:
   - Monitor service status
   - Launch the application in your default browser

## Architecture

- **Frontend**: React with Vite for fast development
- **Backend**: Electron for desktop integration
- **AI Processing**: WebGPU for hardware-accelerated AI operations
- **Development Tools**: Electron Forge for building and packaging

## Technical Stack

- Electron - Desktop application framework
- Vite - Next generation frontend tooling
- React - UI framework
- WebGPU - Hardware acceleration API
- Tailwind CSS - Utility-first CSS framework

## Project Structure

```
llama-3.2-webgpu/
├── src/                    # Source files
│   ├── components/         # React components
│   ├── main.js            # Electron main process
│   └── worker.js          # WebGPU worker
├── public/                 # Static assets
├── control.html           # Control interface
└── package.json           # Project configuration
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
