import { useCallback } from 'react';
import { ExtensionMessage } from '../../../src/shared/ExtensionMessage';

export const useVSCodeMessageHandler = () => {
  const handleMessage = useCallback((event: MessageEvent) => {
    const message: ExtensionMessage = event.data;
    // Individual components handle their own messages via useEvent("message")
    // This hook is available for shared message handling if needed
  }, []);

  return handleMessage;
};
