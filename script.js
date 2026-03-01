// CONFIG
const API_BASE = "https://api.groq.com/openai/v1";
const API_KEY  = "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"; // ← change this
const MODEL    = "llama-3.3-70b-versatile";

// STATE
let currentChatId = null;
const chats = {};
const STORAGE_KEY = "ai_chat_history_2026";

// DOM
const landingScreen   = document.getElementById("landingScreen");
const chatInterface   = document.getElementById("chatInterface");
const messagesArea    = document.getElementById("messages");
const userMessage     = document.getElementById("userMessage");
const sendMessageBtn  = document.getElementById("sendMessageBtn");
const chatTitle       = document.getElementById("chatTitle");
const backBtn         = document.getElementById("backBtn");
const newChatBtn      = document.getElementById("newChatBtn");
const newChatHeaderBtn = document.getElementById("newChatBtnHeader");
const startChatBtn    = document.getElementById("startChatBtn");
const chatList        = document.getElementById("chatList");

// ── Theme ───────────────────────────────────────
document.getElementById("themeBtn").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  document.documentElement.setAttribute("data-theme", current === "dark" ? "light" : "dark");
  localStorage.setItem("theme", current === "dark" ? "light" : "dark");
});

// Init theme
if (localStorage.getItem("theme")) {
  document.documentElement.setAttribute("data-theme", localStorage.getItem("theme"));
} else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
  document.documentElement.setAttribute("data-theme", "light");
}

// ── Chat functions ──────────────────────────────
function loadHistory() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) Object.assign(chats, JSON.parse(saved));
  renderChatList();
  if (Object.keys(chats).length === 0) createNewChat();
  else switchToChat(Object.keys(chats).sort((a,b)=>chats[b].createdAt-chats[a].createdAt)[0]);
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function createNewChat() {
  const id = "c_" + Date.now();
  chats[id] = { title: "New Chat", messages: [], createdAt: Date.now() };
  currentChatId = id;
  saveHistory();
  renderChatList();
  switchToChat(id);
}

function switchToChat(id) {
  if (!chats[id]) return;
  currentChatId = id;
  chatTitle.textContent = chats[id].title;
  renderChatList();
  renderMessages(chats[id].messages);
  landingScreen.classList.add("hidden");
  chatInterface.classList.remove("hidden");
}

function renderChatList() {
  chatList.innerHTML = "";
  Object.entries(chats)
    .sort((a,b) => b[1].createdAt - a[1].createdAt)
    .forEach(([id, chat]) => {
      const div = document.createElement("div");
      div.className = `chat-item ${id === currentChatId ? "active" : ""}`;
      div.innerHTML = `
        <span class="title">${chat.title}</span>
        <button class="delete-chat" data-id="${id}">×</button>
      `;
      div.addEventListener("click", e => {
        if (!e.target.classList.contains("delete-chat")) switchToChat(id);
      });
      chatList.appendChild(div);
    });

  document.querySelectorAll(".delete-chat").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      if (confirm("Delete this chat?")) {
        delete chats[btn.dataset.id];
        saveHistory();
        renderChatList();
        if (btn.dataset.id === currentChatId) createNewChat();
      }
    });
  });
}

function renderMessages(arr) {
  messagesArea.innerHTML = "";
  arr.forEach(m => {
    const msg = document.createElement("div");
    msg.className = `message ${m.role}`;
    msg.innerHTML = `
      <div class="avatar"></div>
      <div class="content">${m.content}</div>
    `;
    messagesArea.appendChild(msg);
  });
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function updateTitle() {
  const txt = chatTitle.textContent.trim();
  if (txt && currentChatId && chats[currentChatId]) {
    chats[currentChatId].title = txt;
    saveHistory();
    renderChatList();
  }
}

// ── Events ──────────────────────────────────────
startChatBtn.addEventListener("click", () => {
  if (!currentChatId) createNewChat();
  switchToChat(currentChatId);
});

backBtn.addEventListener("click", () => {
  chatInterface.classList.add("hidden");
  landingScreen.classList.remove("hidden");
});

newChatBtn.addEventListener("click", createNewChat);
newChatHeaderBtn.addEventListener("click", createNewChat);

chatTitle.addEventListener("blur", updateTitle);
chatTitle.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    chatTitle.blur();
  }
});

sendMessageBtn.addEventListener("click", send);
userMessage.addEventListener("keypress", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

async function send() {
  const text = userMessage.value.trim();
  if (!text || !currentChatId) return;

  chats[currentChatId].messages.push({ role: "user", content: text });
  renderMessages(chats[currentChatId].messages);
  userMessage.value = "";

  // Auto title from first message
  if (chats[currentChatId].title === "New Chat" && text) {
    chatTitle.textContent = text.slice(0,40) + (text.length > 40 ? "..." : "");
    updateTitle();
  }

  const conversation = [
    { role: "system", content: "You are a helpful AI assistant." },
    ...chats[currentChatId].messages
  ];

  try {
    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: conversation,
        temperature: 0.7,
        stream: true
      })
    });

    if (!res.ok) throw new Error("API error");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    const botMsg = document.createElement("div");
    botMsg.className = "message bot";
    botMsg.innerHTML = `<div class="avatar"></div><div class="content"></div>`;
    messagesArea.appendChild(botMsg);
    const contentDiv = botMsg.querySelector(".content");
    messagesArea.scrollTop = messagesArea.scrollHeight;

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            contentDiv.textContent += delta;
            messagesArea.scrollTop = messagesArea.scrollHeight;
          }
        } catch {}
      }
    }

    // save final bot message
    if (contentDiv.textContent) {
      chats[currentChatId].messages.push({
        role: "assistant",
        content: contentDiv.textContent
      });
      saveHistory();
    }
  } catch (err) {
    console.error(err);
    const errMsg = document.createElement("div");
    errMsg.className = "message bot";
    errMsg.innerHTML = `<div class="avatar"></div><div class="content">Error: ${err.message}</div>`;
    messagesArea.appendChild(errMsg);
  }
}

// Init
loadHistory();