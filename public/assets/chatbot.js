
(function () {
    // --- Configuration ---
    const CONFIG = {
        apiChat: '/api/chat-message',
        apiStatus: '/api/chat-status',
        uploadUrl: 'https://workersunited.eu/upload',
        contactUrl: '#contact'
    };

    // --- State ---
    let state = {
        isOpen: false,
        history: [],
        awaitingInput: null // 'email_status', 'email_upload', 'message_human', 'name_human'
    };

    let userData = {
        name: '',
        email: ''
    };

    // --- Inject CSS ---
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/chatbot.css';
    document.head.appendChild(link);

    // --- Create HTML Structure ---
    const container = document.createElement('div');
    container.innerHTML = `
        <div class="wu-chat-btn" id="wuChatBtn">
            <svg class="wu-chat-icon" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
        </div>
        <div class="wu-chat-window" id="wuChatWindow">
            <div class="wu-chat-header">
                <span class="wu-chat-title">Workers United Assistant</span>
                <button class="wu-chat-close" id="wuChatClose">&times;</button>
            </div>
            <div class="wu-chat-messages" id="wuChatMessages"></div>
            <div class="wu-chat-input-area" id="wuChatInputArea" style="display:none;">
                <input type="text" class="wu-chat-input" id="wuChatInput" placeholder="Type here...">
                <button class="wu-chat-send" id="wuChatSend">➤</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);

    // --- Elements ---
    const btn = document.getElementById('wuChatBtn');
    const windowEl = document.getElementById('wuChatWindow');
    const closeBtn = document.getElementById('wuChatClose');
    const messagesEl = document.getElementById('wuChatMessages');
    const inputArea = document.getElementById('wuChatInputArea');
    const inputFn = document.getElementById('wuChatInput');
    const sendBtn = document.getElementById('wuChatSend');

    // --- Event Listeners ---
    btn.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);

    sendBtn.addEventListener('click', handleInput);
    inputFn.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleInput();
    });

    // --- Functions ---

    function toggleChat() {
        state.isOpen = !state.isOpen;
        if (state.isOpen) {
            windowEl.classList.add('open');
            if (messagesEl.children.length === 0) {
                // Initial Greeting
                showTyping();
                setTimeout(() => {
                    addBotMessage("👋 Hello! Welcome to Workers United. How can I help you today?");
                    showOptions([
                        { text: "I need a Job 👷", action: 'job' },
                        { text: "Check Status 🔍", action: 'status' },
                        { text: "Upload Documents 📂", action: 'upload' }
                    ]);
                }, 600);
            }
        } else {
            windowEl.classList.remove('open');
        }
    }

    function addBotMessage(text) {
        removeTyping();
        const div = document.createElement('div');
        div.className = 'wu-msg wu-msg-bot';
        div.innerHTML = text; // Allow HTML
        messagesEl.appendChild(div);
        scrollToBottom();
    }

    function addUserMessage(text) {
        const div = document.createElement('div');
        div.className = 'wu-msg wu-msg-user';
        div.textContent = text;
        messagesEl.appendChild(div);
        scrollToBottom();
    }

    function showTyping() {
        if (document.querySelector('.wu-typing')) return;
        const div = document.createElement('div');
        div.className = 'wu-typing';
        div.innerHTML = '<span></span><span></span><span></span>';
        messagesEl.appendChild(div);
        scrollToBottom();
    }

    function removeTyping() {
        const typing = document.querySelector('.wu-typing');
        if (typing) typing.remove();
    }

    function scrollToBottom() {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function showOptions(options) {
        const div = document.createElement('div');
        div.className = 'wu-actions';
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'wu-btn-option';
            btn.textContent = opt.text;
            btn.onclick = () => handleAction(opt.action);
            div.appendChild(btn);
        });
        messagesEl.appendChild(div);
        scrollToBottom();
    }

    function handleAction(action) {
        // Remove options buttons to prevent double click (optional style choice, keeping them is fine too)
        const actionsDiv = document.querySelector('.wu-actions:last-child');
        if (actionsDiv) actionsDiv.remove();

        // Echo user choice
        if (action === 'job') addUserMessage("I need a Job");
        else if (action === 'status') addUserMessage("Check Application Status");
        else if (action === 'upload') addUserMessage("Upload Documents");
        else if (action === 'restart') addUserMessage("Start Over");

        showTyping();

        setTimeout(() => {
            if (action === 'job') {
                addBotMessage("Great! We connect workers with employers across Europe.");
                addBotMessage("Please fill out our official application form below. It takes 2 minutes.");
                showOptions([{ text: "Go to Form", action: 'goto_form' }, { text: "Back", action: 'restart' }]);
            }
            else if (action === 'goto_form') {
                toggleChat();
                document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
            }
            else if (action === 'status') {
                addBotMessage("To check your status, please enter the **Email Address** you used to apply.");
                setInputMode('email_status');
            }
            else if (action === 'upload') {
                addBotMessage("I can generate a secure upload link for you. Please enter your **Email Address**.");
                setInputMode('email_upload');
            }
            else if (action === 'restart') {
                addBotMessage("How can I help you?");
                showOptions([
                    { text: "I need a Job", action: 'job' },
                    { text: "Check Status", action: 'status' },
                    { text: "Upload Documents", action: 'upload' }
                ]);
            }
        }, 600);
    }

    function setInputMode(mode) {
        state.awaitingInput = mode;
        inputArea.style.display = 'flex';
        inputFn.focus();
    }

    async function handleInput() {
        const text = inputFn.value.trim();
        if (!text) return;

        addUserMessage(text);
        inputFn.value = '';
        inputArea.style.display = 'none'; // Hide input while processing
        showTyping();

        const mode = state.awaitingInput;
        state.awaitingInput = null;

        if (mode === 'email_status') {
            await checkStatus(text);
        }
        else if (mode === 'email_upload') {
            await generateUploadLink(text);
        }
    }

    // --- Logic Handlers ---

    async function checkStatus(email) {
        try {
            const res = await fetch(CONFIG.apiStatus, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();

            removeTyping();
            if (data.found) {
                addBotMessage(`**Status: ${data.status}**`);
                addBotMessage(data.message);
                if (data.hasDocs) addBotMessage("✅ We have your documents.");
                else if (data.status === 'DOCS REQUESTED') addBotMessage("⚠️ We are waiting for your documents.");
            } else {
                addBotMessage("We couldn't find an application with that email.");
                showOptions([{ text: "Try Again", action: 'status' }, { text: "Apply Now", action: 'job' }]);
                return;
            }
        } catch (e) {
            removeTyping();
            addBotMessage("Sorry, I couldn't check the status right now.");
        }
        showOptions([{ text: "Start Over", action: 'restart' }]);
    }

    function generateUploadLink(email) {
        removeTyping();
        const link = `${CONFIG.uploadUrl}?email=${encodeURIComponent(email)}`;
        addBotMessage(`Here is your secure upload link:`);
        addBotMessage(`<a href="${link}" target="_blank" style="color:#2563eb; text-decoration:underline; font-weight:bold;">Click here to Upload Documents</a>`);
        showOptions([{ text: "Start Over", action: 'restart' }]);
    }

    async function sendHumanMessage(msg) {
        try {
            const res = await fetch(CONFIG.apiChat, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userData.email,
                    message: msg,
                    type: 'Bot Inquiry'
                })
            });
            removeTyping();
            if (res.ok) {
                addBotMessage("✅ Application received! Our team will contact you via email.");
            } else {
                addBotMessage("⚠️ Something went wrong. Please email us at contact@workersunited.eu");
            }
        } catch (e) {
            removeTyping();
            addBotMessage("⚠️ Network error. Please try again.");
        }
        showOptions([{ text: "Start Over", action: 'restart' }]);
    }

})();
