
# Transformers.js - Sample Electron application

An example project to show how to run 🤗 Transformers in an [Electron](https://www.electronjs.org/) application.

## Getting Started
1. Clone the repo and enter the project directory:
    ```bash
    git clone https://github.com/huggingface/transformers.js-examples.git
    cd transformers.js-examples/electron/
    ```
1. Install the necessary dependencies:
    ```bash
    npm install 
    ```

1. Run the application:
    ```bash
    npm run start 
    ```

    After a few seconds, a new window should pop up on your screen!


## Editing the template


All source code can be found in `./src/`:
- `index.js` - Serves as the entry point for the application's main process. When an Electron app is launched, this is the first file that gets executed, and it is responsible for setting up the main process of the application. You will need to restart the application after editing this file for your changes to take effect.
- `preload.js` - Used to preload scripts and modules in a renderer process before any other scripts run. In our case, we use the `contextBridge` API to expose the `classify` function to the renderer, which runs the model in the background. You will need to restart the application after editing this file for your changes to take effect.
- `classify.js` - Contains logic for loading the model and running predictions via the `classify` function. You will need to restart the application after editing this file for your changes to take effect.

- `index.html`, `index.css` - The user interface that is displayed to the user, along with example code for how to call the `classify` function from the renderer process. To see changes made to this file made while editing, simply refresh the window (<kbd>Ctrl + R</kbd> or "View" &rarr; "Reload").
