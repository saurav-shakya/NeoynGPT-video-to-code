import { useCallback } from 'react';
import { ExtensionMessage } from '../../../src/shared/ExtensionMessage';
import { WebviewMessage } from '../../../src/shared/WebviewMessage';

export const useVSCodeMessageHandler = () => {
  const handleMessage = useCallback((message: WebviewMessage) => {
    // Handle different message types here
    switch (message.type) {
      case 'EXTENSION_READY':
        // Handle extension ready message
        break;
      case 'UPDATE_STATE':
        // Handle state update message
        break;
      default:
        console.warn('Unhandled message type:', message.type);
    }
  }, []);

  return handleMessage;
}; 