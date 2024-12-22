document.addEventListener('DOMContentLoaded', () => {
    // Header buttons
    document.getElementById('addBtn').addEventListener('click', () => {
        console.log('Add button clicked');
        // Add your logic here
    });

    document.getElementById('historyBtn').addEventListener('click', () => {
        console.log('History button clicked');
        // Add your logic here
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
        console.log('Refresh button clicked');
        // Add your logic here
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
        console.log('Settings button clicked');
        // Add your logic here
    });

    // Input section buttons
    document.getElementById('videoBtn').addEventListener('click', () => {
        console.log('Video button clicked');
        // Add your logic here
    });

    document.getElementById('imageBtn').addEventListener('click', () => {
        console.log('Image button clicked');
        // Add your logic here
    });

    document.getElementById('attachBtn').addEventListener('click', () => {
        console.log('Attach button clicked');
        // Add your logic here
    });

    document.getElementById('sendBtn').addEventListener('click', () => {
        const input = document.getElementById('askInput');
        const message = input.value.trim();
        if (message) {
            console.log('Sending message:', message);
            // Add your send logic here
            input.value = ''; // Clear input after sending
        }
    });

    // Handle enter key in input
    document.getElementById('askInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const input = e.target;
            const message = input.value.trim();
            if (message) {
                console.log('Sending message:', message);
                // Add your send logic here
                input.value = ''; // Clear input after sending
            }
        }
    });
}); 