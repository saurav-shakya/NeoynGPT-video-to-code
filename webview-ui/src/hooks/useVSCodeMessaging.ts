import { useCallback } from 'react';
import { ExtensionMessage } from '../../../src/shared/ExtensionMessage';
import { vscode } from '../utils/vscode';

export const useVSCodeMessaging = () => {
  const sendMessage = useCallback((message: ExtensionMessage) => {
    vscode.postMessage(message);
  }, []);

  return sendMessage;
}; 