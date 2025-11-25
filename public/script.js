// --- Configuration & Initialization ---
const wsUri = `ws://${window.location.host}`; // Uses the same host as the HTTP server
let ws;
let currentNick = null;
let isMuted = false;
let isBanned = false; // Client-side flag to handle ban/kick persistence after disconnect

// UI Element References
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const messageArea = document.getElementById('message-area');
const userList = document.getElementById('user-list');
const userCountSpan = document.getElementById('user-count');
const statusSpan = document.getElementById('connection-status');

// Modal References
const modalBackdrop = document.getElementById('modal-backdrop');
const modalContent = document.getElementById('modal-content');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const nickForm = document.getElementById('nick-form');
const nickInput = document.getElementById('nick-input');
const nickSubmitButton = document.getElementById('nick-submit-button');

// --- Utility Functions ---

/**
 * Displays a message in the chat area.
 * @param {string} nick - The sender's nickname.
 * @param {string} text - The message text.
 * @param {string} timestamp - The message timestamp.
 * @param {boolean} isSystem - True if it's a system message.
 * @param {boolean} isHighlight - True if the message should be highlighted.
 */
function displayMessage(nick, text, timestamp, isSystem = false, isHighlight = false) {
    const isSelf = nick === currentNick;
    const isNimda = nick.toLowerCase() === 'nimda';

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('flex', 'items-start', 'space-x-2');
    
    // Base classes for the content box
    let contentClasses = [
        'p-3', 'rounded-xl', 'max-w-[80%]', 'break-words', 'shadow-sm', 
        'transition-all', 'duration-500'
    ];
    
    // Color and alignment based on sender
    if (isSystem) {
        messageDiv.classList.add('justify-center');
        contentClasses = [
            'text-center', 'text-sm', 'italic', 'text-gray-500', 
            'bg-gray-100', 'py-1', 'px-3', 'rounded-full'
        ];
    } else if (isSelf) {
        messageDiv.classList.add('justify-end');
        contentClasses.push('bg-indigo-500', 'text-white', 'rounded-br-none');
    } else {
        messageDiv.classList.add('justify-start');
        contentClasses.push('bg-gray-200', 'text-gray-800', 'rounded-tl-none');
    }

    if (isHighlight) {
         // Apply distinct highlight styling
         contentClasses.push('ring-4', 'ring-yellow-400', 'bg-yellow-100', 'text-gray-900', 'font-bold', 'animate-pulse');
         if (isSystem) contentClasses.push('!bg-yellow-200', '!text-gray-900'); // Override system message background for highlights
    }

    const contentDiv = document.createElement('div');
    contentDiv.classList.add(...contentClasses);

    if (!isSystem) {
        // Nickname and Timestamp for regular messages
        const header = document.createElement('div');
        header.classList.add('flex', isSelf ? 'justify-end' : 'justify-start', 'items-center', 'mb-1');
        
        const nickSpan = document.createElement('span');
        nickSpan.textContent = nick;
        nickSpan.classList.add(
            'font-semibold', 
            'mr-2', 
            isSelf ? 'text-white' : 'text-gray-900',
            isNimda ? 'text-red-600' : ''
        );

        const timeSpan = document.createElement('span');
        timeSpan.textContent = timestamp;
        timeSpan.classList.add('text-xs', isSelf ? 'text-indigo-200' : 'text-gray-500');

        header.appendChild(nickSpan);
        header.appendChild(timeSpan);
        contentDiv.appendChild(header);
    }

    // Message Text
    const textP = document.createElement('p');
    textP.textContent = text;
    textP.classList.add(isSystem ? 'text-sm' : 'text-base');

    if (isSystem) {
        contentDiv.appendChild(textP);
    } else {
        // Find existing header or create a temporary one if needed
        const header = contentDiv.querySelector('div') || document.createElement('div');
        contentDiv.appendChild(textP);
    }

    if (isSystem) {
         messageDiv.appendChild(contentDiv);
    } else if (isSelf) {
        messageDiv.appendChild(contentDiv);
    } else {
        messageDiv.appendChild(contentDiv);
    }
    
    // Add the message to the area
    messageArea.appendChild(messageDiv);
    
    // Scroll to bottom
    messageArea.scrollTop = messageArea.scrollHeight;
}

/**
 * Shows the custom modal with dynamic content.
 * @param {string} title 
 * @param {string} message 
 * @param {boolean} showInput - Whether to show the nickname input form.
 */
function showModal(title, message, showInput) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    nickForm.classList.toggle('hidden', !showInput);
    modalBackdrop.classList.remove('hidden');
    modalBackdrop.classList.add('flex');
    if (showInput) {
        // If showing the nick form, focus the input
        nickInput.value = currentNick || ''; // Pre-fill if trying to reconnect
        nickInput.focus();
    }
}

/**
 * Hides the custom modal.
 */
function hideModal() {
    modalBackdrop.classList.add('hidden');
    modalBackdrop.classList.remove('flex');
}

/**
 * Updates the UI state for input based on connection and local flags.
 */
function updateInputState() {
    const isDisabled = !ws || ws.readyState !== WebSocket.OPEN || !currentNick || isMuted || isBanned;
    chatInput.disabled = isDisabled;
    sendButton.disabled = isDisabled;
    
    let placeholderText = "Type a message or command (e.g., /help)";
    if (isBanned) {
        placeholderText = "You are currently banned and cannot send messages.";
    } else if (isMuted) {
        placeholderText = "You are currently muted and cannot send messages.";
    } else if (!currentNick) {
        placeholderText = "Please set your nickname to chat.";
    } else if (ws.readyState !== WebSocket.OPEN) {
        placeholderText = "Connection lost. Please refresh or check status.";
    }
    chatInput.placeholder = placeholderText;
}

// --- WebSocket Handlers ---

function connectWebSocket() {
    statusSpan.textContent = 'Connecting...';
    statusSpan.classList.remove('text-red-500', 'text-green-500');
    
    ws = new WebSocket(wsUri);

    ws.onopen = () => {
        statusSpan.textContent = 'Connected';
        statusSpan.classList.add('text-green-500');
        
        // If we have a stored nick and aren't banned, try to re-send it
        if (currentNick && !isBanned) {
            ws.send(JSON.stringify({ type: "nick", nick: currentNick }));
        } else if (!isBanned) {
            // Show the nickname modal only if not banned and no nick is set
            showModal("Set Nickname", "Please choose a nickname to join the chat.", true);
        }
        updateInputState();
    };

    ws.onmessage = event => {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (e) {
            console.error("Received non-JSON message:", event.data);
            return;
        }

        switch (data.type) {
            case 'error':
                // Handle nickname errors (taken, invalid, banned)
                showModal("Error", data.message, true);
                break;

            case 'nick':
                // Nick acceptance is handled implicitly by the absence of an error
                // and the "users" update from the server.
                break;

            case 'chat':
                // Regular or System message
                const isSystem = data.nick === "SYSTEM";
                displayMessage(data.nick, data.text, data.timestamp, isSystem, false);
                break;

            case 'users':
                // Update user list
                userList.innerHTML = '';
                userCountSpan.textContent = data.users.length;
                data.users.forEach(nick => {
                    const li = document.createElement('li');
                    li.textContent = nick;
                    li.classList.add('p-1', 'px-2', 'rounded-md', 'text-gray-700', 'flex', 'justify-between', 'items-center', 'font-medium');
                    if (nick.toLowerCase() === 'nimda') {
                        li.classList.add('bg-red-200', 'text-red-800', 'font-bold');
                        li.title = 'Administrator';
                    } else if (nick === currentNick) {
                        li.classList.add('bg-indigo-100', 'text-indigo-800');
                        li.title = 'You';
                    } else {
                        li.classList.add('hover:bg-gray-200', 'cursor-default');
                    }
                    // Check if this user is currently known to be muted (client-side guess)
                    if (isMuted && nick === currentNick) {
                        li.textContent += ' (Muted)';
                        li.classList.add('line-through', 'opacity-75');
                    }
                    userList.appendChild(li);
                });
                break;
            
            case 'highlight':
                // Admin /highlight command
                displayMessage("SYSTEM", `Admin Announcement: ${data.text}`, new Date().toLocaleTimeString(), true, true);
                break;

            case 'clear':
                // Admin /clear command
                messageArea.innerHTML = '';
                break;

            case 'kick':
                // Admin /kick command
                isBanned = true; // Use this flag to prevent reconnection attempts
                isMuted = false;
                showModal("Kicked", `You have been kicked for ${data.minutes} minutes.`, false);
                statusSpan.textContent = 'Disconnected (Kicked)';
                statusSpan.classList.add('text-red-500');
                ws.close();
                updateInputState();
                break;

            case 'ban':
                // Admin /ban command (or auto-ban)
                isBanned = true; // Use this flag to prevent reconnection attempts
                isMuted = false;
                showModal("Banned", `You have been banned for ${data.minutes} minutes.`, false);
                statusSpan.textContent = 'Disconnected (Banned)';
                statusSpan.classList.add('text-red-500');
                ws.close();
                updateInputState();
                break;
        }
    };

    ws.onclose = () => {
        statusSpan.textContent = 'Disconnected';
        statusSpan.classList.remove('text-green-500');
        statusSpan.classList.add('text-red-500');
        
        // If closure was not due to a kick/ban, attempt to reconnect
        if (currentNick && !isBanned) {
            // Display a system message that connection was lost
            displayMessage("SYSTEM", "Connection lost. Attempting to reconnect...", new Date().toLocaleTimeString(), true);
            setTimeout(connectWebSocket, 3000); // Reconnect after 3 seconds
        }
        updateInputState();
    };

    ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        statusSpan.textContent = 'Error';
        statusSpan.classList.add('text-red-500');
        ws.close();
        updateInputState();
    };
}


// --- Event Listeners ---

// 1. Nickname Form Submission (Modal)
nickForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newNick = nickInput.value.trim();
    if (newNick) {
        // Assume successful if no immediate error
        currentNick = newNick;
        hideModal();
        if (ws && ws.readyState === WebSocket.OPEN) {
            // Send nick to server for validation/registration
            ws.send(JSON.stringify({ type: "nick", nick: currentNick }));
        } else {
            // If WS is not open, connectWebSocket will handle it
            connectWebSocket();
        }
    }
});

// 2. Chat Form Submission
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    
    if (text === "") return;
    
    if (currentNick && ws && ws.readyState === WebSocket.OPEN) {
        // Simple client-side check for help command
        if (text.toLowerCase() === '/help') {
             displayMessage("SYSTEM", "Available Admin Commands (Requires Nick 'nimda'): /ban [nick], /kick [nick], /mute [nick], /unmute [nick], /rename [old_nick] [new_nick], /freeze, /unfreeze, /clear, /highlight [text].", new Date().toLocaleTimeString(), true);
        } else {
            // Send chat message (or admin command if nick is nimda)
            ws.send(JSON.stringify({ type: "chat", nick: currentNick, text: text }));
        }
        chatInput.value = '';
    }
});


// --- Initial Setup ---

window.onload = () => {
    // Start the connection process on page load
    connectWebSocket();
};
