document.addEventListener("DOMContentLoaded", () => {
    const ws = new WebSocket(`ws://${location.host}`);

    const messagesDiv = document.getElementById("messages");
    const usersDiv = document.getElementById("users");
    const nameInput = document.getElementById("nameInput");
    const msgInput = document.getElementById("msgInput");
    const sendBtn = document.getElementById("sendBtn");
    const suggestionsDiv = document.getElementById("commandSuggestions");

    // Updated list to show explicit /mute and /unmute commands
    const adminCommands = [
        "/kick [name]",
        "/ban [name]",
        "/rename [old] [new]",
        "/highlight [message]",
        "/mute [name]",  // Now strictly MUTE
        "/unmute [name]",// NEW: Explicit UNMUTE command
        "/unban [name]",
        "/clear",
        "/freeze",   
        "/unfreeze"  
    ];

    let myNick = null;

    // --- Nickname Setup ---
    function setNick() {
        if (!myNick) {
            myNick = nameInput.value.trim() || "anon";
            nameInput.disabled = true;
            ws.send(JSON.stringify({ type: "nick", nick: myNick }));
            
            if (myNick.toLowerCase() === "nimda") {
                suggestionsDiv.style.display = "block";
                suggestionsDiv.innerHTML = adminCommands.map(c => `<div>${c}</div>`).join("");
            }
        }
    }
    nameInput.addEventListener("keydown", e => { if (e.key === "Enter") setNick(); });
    nameInput.addEventListener("blur", setNick);

    suggestionsDiv.addEventListener("click", e => {
        if (e.target.tagName === "DIV") {
            let text = e.target.textContent;
            // When clicking a suggestion, remove argument placeholders 
            text = text.replace(/\[\w+\]/g, '').trim(); 
            msgInput.value = text;
            msgInput.focus();
        }
    });

    // --- Send Message ---
    function sendMessage() {
        if (!myNick || ws.readyState !== WebSocket.OPEN) return; 
        
        const text = msgInput.value.trim();
        if (!text) return;

        ws.send(JSON.stringify({ type: "chat", nick: myNick, text }));
        msgInput.value = "";
        msgInput.focus();
    }
    sendBtn.addEventListener("click", sendMessage);
    msgInput.addEventListener("keydown", e => { if (e.key === "Enter") sendMessage(); });

    // --- Receive Messages ---
    ws.addEventListener("message", event => {
        let data;
        try { data = JSON.parse(event.data); } catch (e) { return; }

        if (data.type === "error") {
            console.error(`Error: ${data.message}`);
            if (!data.message.includes("banned")) {
                nameInput.disabled = false;
                nameInput.focus();
                myNick = null;
                suggestionsDiv.style.display = "none";
            }
            return;
        }

        if (data.type === "users") {
            // Use Set to ensure unique usernames before rendering
            const uniqueUsers = Array.from(new Set(data.users));

            usersDiv.innerHTML = uniqueUsers
                // Map 'nimda' to the red 'ADMIN' label
                .map(u => u.toLowerCase() === "nimda" ? `<div class="admin-user">ADMIN</div>` : `<div>${u}</div>`)
                .join("");
            return;
        }
        
        if (data.type === "clear") {
            messagesDiv.innerHTML = '';
        }

        // System messages must be handled here.
        if (data.type === "chat" && data.nick === "SYSTEM") {
            const div = document.createElement("div");
            div.className = "system"; 
            div.textContent = `*** ${data.text} ***`;
            messagesDiv.appendChild(div);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            return;
        }

        // REGULAR CHAT
        if (data.type === "chat") {
            const div = document.createElement("div");
            
            if (data.nick.toLowerCase() === "nimda") {
                 div.classList.add("adminMsg");
            } else {
                div.className = "message";
            }
            
            const timestampSpan = `<span class="timestamp">${data.timestamp}</span>`;

            const displayName = data.nick.toLowerCase() === "nimda" ? "ADMIN" : data.nick;
            div.innerHTML = `[${displayName}]: ${data.text} ${timestampSpan}`;
            messagesDiv.appendChild(div);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            return;
        }

        // BAN/KICK (Client-side enforcement)
        if (data.type === "ban" || data.type === "kick") {
            const reason = data.type === "ban" ? "banned" : "kicked";
            const duration = data.minutes;
            
            const notificationDiv = document.createElement("div");
            notificationDiv.className = "system action-message";
            notificationDiv.textContent = `!!! You have been temporarily ${reason} for ${duration} minutes. !!!`;
            messagesDiv.appendChild(notificationDiv);
            
            msgInput.disabled = true;
            sendBtn.disabled = true;
            
            setTimeout(() => {
                msgInput.disabled = false;
                sendBtn.disabled = false;
                const reenableDiv = document.createElement("div");
                reenableDiv.className = "system";
                reenableDiv.textContent = `*** You can chat again. ***`;
                messagesDiv.appendChild(reenableDiv);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }, duration * 60 * 1000); 
            return;
        }

        // HIGHLIGHT
        if (data.type === "highlight") {
            const div = document.createElement("div");
            div.className = "highlight";
            div.textContent = `*** ANNOUNCEMENT: ${data.text} ***`;
            messagesDiv.appendChild(div);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            return;
        }
    });
});