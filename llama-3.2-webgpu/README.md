# Llama 3.2 WebGPU Desktop Service

A desktop application built with Electron that provides a convenient interface for running the Llama 3.2 WebGPU service. This project is based on [transformers.js-examples](https://github.com/huggingface/transformers.js-examples) by Hugging Face.

## Key Features

- Seamless system tray integration for minimal resource usage
- Single-click web service activation
- Intuitive control interface for service management
- Chrome/Edge browser compatibility
- Integrated development server
- WebGPU hardware acceleration support

## Screenshots

Control Interface:


Browser Interface:


## System Requirements

- Node.js v20.18.1 or later
- npm v11.0.0 or later
- WebGPU-compatible browser (Chrome/Edge)
- Graphics card with WebGPU support

## Quick Start

```bash
# Clone the repository
git clone [repository-url]
cd llama-3.2-webgpu

# Install dependencies
npm install

# Start development server
npm run electron:dev

# Build for production
npm run build

# Package application
npm run make
```

## Using the Application

1. Launch the application - it will minimize to system tray
2. Access via system tray icon:
   - Open control panel
   - Launch web interface
   - Exit application
3. Control panel features:
   - Service status monitoring
   - Browser launch button
   - Configuration options

## Technical Architecture

### Core Components

- Frontend: React + Vite
- Desktop Framework: Electron
- AI Processing: WebGPU
- Build System: Electron Forge
- Styling: Tailwind CSS

### Directory Structure

```
llama-3.2-webgpu/
├── src/
│   ├── components/    # React UI components
│   ├── main.js       # Electron main process
│   └── worker.js     # WebGPU worker thread
├── public/           # Static assets
├── control.html      # Control interface
└── package.json      # Project config
```

## Development Guide

### Development Mode

```bash
npm run electron:dev
```

This will:

- Start Vite dev server
- Launch Electron app
- Enable hot reload

### Production Build

```bash
npm run build
npm run make
```

Packaged application will be in the `out` directory.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/enhancement`)
3. Commit changes (`git commit -m 'Add enhancement'`)
4. Push to branch (`git push origin feature/enhancement`)
5. Submit Pull Request

## License and Attribution

This project is a fork of [transformers.js-examples](https://github.com/huggingface/transformers.js-examples) by Hugging Face. The original code and its modifications are subject to the original license terms. All rights to the original code belong to Hugging Face and its contributors.

Any additional modifications and new code in this fork are released under the terms of the original license.

Please refer to the original repository for complete license information.

## Acknowledgments

- [Hugging Face](https://huggingface.co/) for the original transformers.js-examples
- The Electron team for the desktop application framework
- WebGPU working group for the hardware acceleration API
