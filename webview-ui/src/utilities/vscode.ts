declare global {
    interface Window {
        acquireVsCodeApi(): any;
    }
}

class VSCodeAPIWrapper {
    private readonly vsCodeApi: any;

    constructor() {
        // Check if the acquireVsCodeApi function exists
        if (window.acquireVsCodeApi) {
            this.vsCodeApi = window.acquireVsCodeApi();
        }
    }

    public postMessage(message: any) {
        if (this.vsCodeApi) {
            this.vsCodeApi.postMessage(message);
        }
    }

    public getState() {
        if (this.vsCodeApi) {
            return this.vsCodeApi.getState();
        }
        return undefined;
    }

    public setState(state: any) {
        if (this.vsCodeApi) {
            this.vsCodeApi.setState(state);
        }
    }
}

export const vscode = new VSCodeAPIWrapper(); 