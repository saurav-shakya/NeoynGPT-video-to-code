import React, { useState } from 'react';
import { vscode } from '../utilities/vscode';

export const ChatInput: React.FC = () => {
    const [message, setMessage] = useState('');
    const [currentVideoFile, setCurrentVideoFile] = useState<string | null>(null);

    const handleVideoUpload = () => {
        vscode.postMessage({ type: 'uploadVideo' });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            vscode.postMessage({ 
                type: 'sendMessage', 
                text: message,
                hasVideo: !!currentVideoFile 
            });
            setMessage('');
        }
    };

    // Listen for messages from extension
    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.type) {
            case 'setVideoUri':
                setCurrentVideoFile(message.fileName);
                break;
            case 'getVideoUri':
                return currentVideoFile;
        }
    });

    return (
        <div className="chat-input-container">
            {currentVideoFile && (
                <div className="current-video">
                    Current video: {currentVideoFile}
                </div>
            )}
            <form onSubmit={handleSubmit} className="chat-form">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your task here (@context)"
                    className="chat-input"
                />
                <div className="button-group">
                    <button 
                        type="button"
                        className="icon-button"
                        title="Add Image"
                    >
                        +
                    </button>
                    <button 
                        type="button" 
                        onClick={handleVideoUpload}
                        className="icon-button"
                        title="Upload Video"
                    >
                        📹
                    </button>
                    <button type="submit" className="send-button">
                        ➤
                    </button>
                </div>
            </form>
        </div>
    );
}; 