const API = "https://moasis-backend.onrender.com/api.php";

const state = {
    users: [],
    posts: [],
    friendRequests: [],
    profileDetails: {},
    currentUser: JSON.parse(localStorage.getItem("mosais:user") || "null"),
    selectedUserId: null,
    search: "",
    apiReady: false,
    admin: null,
    currentView: 'feed', // 'feed', 'profile', 'admin', 'friends', 'messages'
    activeChatUserId: null,
    activeChatMessages: []
};

const els = {
    appShell: document.querySelector("#appShell"),
    headerAvatar: document.querySelector("#headerAvatar"),
    headerName: document.querySelector("#headerName"),
    composerAvatar: document.querySelector("#composerAvatar"),
    feedList: document.querySelector("#feedList"),
    profileFeedList: document.querySelector("#profileFeedList"),
    selectedUser: document.querySelector("#selectedUser"),
    searchInput: document.querySelector("#searchInput"),
    searchResults: document.querySelector("#searchResults"),
    postForm: document.querySelector("#postForm"),
    postMessage: document.querySelector("#postMessage"),
    
    // Views
    mainFeedView: document.querySelector("#mainFeedView"),
    profileFeedView: document.querySelector("#profileFeedView"),
    adminDashboardView: document.querySelector("#adminDashboardView"),
    friendsView: document.querySelector("#friendsView"),
    messagesView: document.querySelector("#messagesView"),
    
    // Header Buttons
    adminButton: document.querySelector("#adminButton"),
    friendsButton: document.querySelector("#friendsButton"),
    messagesButton: document.querySelector("#messagesButton"),
    
    // View internals
    adminStats: document.querySelector("#adminStats"),
    adminLog: document.querySelector("#adminLog"),
    composerPanel: document.querySelector("#composerPanel"),
    profilePanel: document.querySelector("#profilePanel"),
    profileForm: document.querySelector("#profileForm"),
    profileMessage: document.querySelector("#profileMessage"),
    friendRequestsList: document.querySelector("#friendRequestsList"),
    messageFriendsList: document.querySelector("#messageFriendsList"),
    activeChat: document.querySelector("#activeChat"),
    messageForm: document.querySelector("#messageForm"),
    messageInput: document.querySelector("#messageInput"),
    messageSendBtn: document.querySelector("#messageSendBtn")
};

document.addEventListener("DOMContentLoaded", init);
if (els.postForm) els.postForm.addEventListener("submit", createPost);
if (els.profileForm) els.profileForm.addEventListener("submit", saveProfile);

if (els.searchInput) {
    els.searchInput.addEventListener("input", (event) => {
        state.search = event.target.value.trim().toLowerCase();
        renderSearch();
    });
    document.addEventListener("click", (e) => {
        if (!els.searchInput.contains(e.target) && !els.searchResults.contains(e.target)) {
            els.searchResults.classList.add("hidden");
        }
    });
    els.searchInput.addEventListener("focus", () => {
        if (state.search) renderSearch();
    });
}

if (els.messageForm) {
    els.messageForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const body = els.messageInput.value.trim();
        if (!body || !state.activeChatUserId) return;
        els.messageInput.disabled = true;
        els.messageSendBtn.disabled = true;
        await sendMessage(state.activeChatUserId, body);
        els.messageInput.value = "";
        els.messageInput.disabled = false;
        els.messageSendBtn.disabled = false;
        els.messageInput.focus();
    });
}

window.goHome = () => {
    state.currentView = 'feed';
    state.search = '';
    if (els.searchInput) els.searchInput.value = '';
    if (els.searchResults) els.searchResults.classList.add('hidden');
    render();
};

window.showAdmin = () => { state.currentView = 'admin'; render(); };
window.showFriends = () => { state.currentView = 'friends'; render(); };
window.showMessages = () => { state.currentView = 'messages'; render(); };

window.handleSessionClick = () => {
    if (state.currentUser) {
        selectUser(state.currentUser.id);
    } else {
        window.location.href = "login.html";
    }
};

window.logoutUser = () => {
    state.currentUser = null;
    state.profileDetails = {};
    localStorage.removeItem("mosais:user");
    window.location.href = "login.html";
};

async function init() {
    await loadBootstrap();
    await loadAdmin();
    render();
}

async function loadBootstrap() {
    try {
        const viewerId = state.currentUser ? state.currentUser.id : 0;
        const response = await fetch(`${API}?action=bootstrap&viewerId=${viewerId}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);

        state.users = data.users || [];
        state.posts = data.posts || [];
        state.friendRequests = data.friendRequests || [];
        state.apiReady = true;
        
        // Update currentUser data from users list
        if (state.currentUser) {
            const upToDateUser = state.users.find(u => u.id === state.currentUser.id);
            if (upToDateUser) {
                state.currentUser = {...state.currentUser, ...upToDateUser};
                localStorage.setItem("mosais:user", JSON.stringify(state.currentUser));
            }
        }
    } catch (error) {
        state.apiReady = false;
        alert("The PHP API is not connected. Run: php -S localhost:8000 -t .");
        console.error(error);
    }
}

async function loadAdmin() {
    state.admin = null;
    if (!state.currentUser?.isAdmin) return;
    try {
        const response = await fetch(`${API}?action=adminStats&viewerId=${state.currentUser.id}`);
        const data = await response.json();
        if (response.ok) state.admin = data;
    } catch (error) {}
}

async function loadSelectedProfile(userId) {
    if (!userId) return;
    const viewerId = state.currentUser ? state.currentUser.id : 0;
    try {
        const response = await fetch(`${API}?action=profile&userId=${userId}&viewerId=${viewerId}`);
        const data = await response.json();
        if (response.ok && data.user) {
            state.profileDetails[userId] = data.user;
        }
    } catch (error) {}
}

async function saveProfile(event) {
    event.preventDefault();
    if (!state.currentUser) return;
    els.profileMessage.textContent = "Saving your profile...";
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    payload.id = state.currentUser.id;

    const response = await fetch(`${API}?action=updateProfile`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
        els.profileMessage.textContent = data.error || "Profile could not be saved.";
        return;
    }

    state.currentUser = data.user;
    state.users = data.users;
    state.posts = data.posts || state.posts;
    state.profileDetails[data.user.id] = data.user;
    localStorage.setItem("mosais:user", JSON.stringify(data.user));
    els.profileMessage.textContent = "Profile updated successfully.";
    await loadAdmin();
    render();
}

async function createPost(event) {
    event.preventDefault();
    if (!state.currentUser) return;
    els.postMessage.textContent = "Posting...";
    const form = new FormData(event.currentTarget);
    const body = String(form.get("body") || "").trim();
    const mood = "Update";

    const response = await fetch(`${API}?action=createPost`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: state.currentUser.id, body, mood })
    });
    const data = await response.json();
    if (!response.ok) {
        els.postMessage.textContent = data.error || "Could not post.";
        return;
    }
    state.posts = data.posts || state.posts;
    els.postForm.reset();
    els.postMessage.textContent = "";
    await loadAdmin();
    render();
}

window.addFriend = async (targetId) => {
    if (!state.currentUser) return;
    const response = await fetch(`${API}?action=sendFriendRequest`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: state.currentUser.id, targetId })
    });
    if (response.ok) {
        await loadBootstrap(); // Reload requests
        render();
    }
};

window.respondFriendRequest = async (requestId, accept) => {
    if (!state.currentUser) return;
    const response = await fetch(`${API}?action=respondFriendRequest`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: state.currentUser.id, requestId, accept })
    });
    if (response.ok) {
        await loadBootstrap();
        render();
    }
};

window.openChat = async (friendId) => {
    state.activeChatUserId = friendId;
    state.currentView = 'messages';
    await loadMessages();
    render();
};

async function loadMessages() {
    if (!state.currentUser || !state.activeChatUserId) return;
    const response = await fetch(`${API}?action=getMessages&userId=${state.currentUser.id}&friendId=${state.activeChatUserId}`);
    const data = await response.json();
    if (response.ok) {
        state.activeChatMessages = data.messages || [];
    }
}

async function sendMessage(friendId, body) {
    if (!state.currentUser) return;
    const response = await fetch(`${API}?action=sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: state.currentUser.id, friendId, body })
    });
    if (response.ok) {
        await loadMessages();
        render();
    }
}

async function toggleLike(postId) {
    if (!state.currentUser) { window.location.href = "login.html"; return; }
    const response = await fetch(`${API}?action=toggleLike`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: state.currentUser.id, postId })
    });
    const data = await response.json();
    if (response.ok) { state.posts = data.posts || state.posts; await loadAdmin(); render(); }
}

async function addComment(postId, body) {
    if (!state.currentUser) { window.location.href = "login.html"; return; }
    const response = await fetch(`${API}?action=addComment`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: state.currentUser.id, postId, body })
    });
    const data = await response.json();
    if (response.ok) { state.posts = data.posts || state.posts; await loadAdmin(); render(); } 
    else { alert(data.error || "Comment failed."); }
}

async function updatePost(postId, body, mood) {
    if (!state.currentUser) return;
    const response = await fetch(`${API}?action=updatePost`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: state.currentUser.id, postId, body, mood })
    });
    const data = await response.json();
    if (response.ok) { state.posts = data.posts || state.posts; await loadAdmin(); render(); } 
    else { alert(data.error || "Update failed."); }
}

async function deletePost(postId) {
    if (!state.currentUser) return;
    if (!confirm("Delete this post?")) return;
    const response = await fetch(`${API}?action=deletePost`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: state.currentUser.id, postId })
    });
    const data = await response.json();
    if (response.ok) { state.posts = data.posts || state.posts; await loadAdmin(); render(); } 
    else { alert(data.error || "Delete failed."); }
}

window.updateComment = async (commentId, oldBody) => {
    if (!state.currentUser) return;
    const body = prompt("Edit comment:", oldBody);
    if (body === null || body.trim() === "") return;
    const response = await fetch(`${API}?action=updateComment`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: state.currentUser.id, commentId, body: body.trim() })
    });
    const data = await response.json();
    if (response.ok) { state.posts = data.posts || state.posts; await loadAdmin(); render(); } 
    else { alert(data.error || "Update failed."); }
};

window.deleteComment = async (commentId) => {
    if (!state.currentUser) return;
    if (!confirm("Delete this comment?")) return;
    const response = await fetch(`${API}?action=deleteComment`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: state.currentUser.id, commentId })
    });
    const data = await response.json();
    if (response.ok) { state.posts = data.posts || state.posts; await loadAdmin(); render(); } 
    else { alert(data.error || "Delete failed."); }
};

async function selectUser(userId) {
    state.selectedUserId = userId;
    state.currentView = 'profile';
    state.search = '';
    els.searchInput.value = '';
    els.searchResults.classList.add("hidden");
    await loadSelectedProfile(userId);
    render();
}
window.selectUser = selectUser;

function renderSearch() {
    if (!state.search) { els.searchResults.classList.add("hidden"); return; }
    const users = state.users.filter((u) => `${u.name} ${u.surname} ${u.city} ${u.headline}`.toLowerCase().includes(state.search));
    if (users.length === 0) {
        els.searchResults.innerHTML = `<div style="padding: 12px; color: var(--muted); text-align: center;">No results found</div>`;
    } else {
        els.searchResults.innerHTML = users.map((u) => `
            <div class="search-result-item" onclick="selectUser(${u.id})">
                <div class="avatar">${escapeHtml(u.avatar)}</div>
                <div class="search-result-info">
                    <strong>${escapeHtml(u.name)} ${escapeHtml(u.surname)}</strong>
                    <span>${escapeHtml(u.city)}</span>
                </div>
            </div>
        `).join("");
    }
    els.searchResults.classList.remove("hidden");
}

function render() {
    if (!state.apiReady) return;
    
    renderHeader();
    
    // Hide all views
    els.mainFeedView.classList.add('hidden');
    els.profileFeedView.classList.add('hidden');
    els.adminDashboardView.classList.add('hidden');
    els.friendsView.classList.add('hidden');
    els.messagesView.classList.add('hidden');

    if (state.currentView === 'feed') {
        els.mainFeedView.classList.remove('hidden');
        els.composerPanel.classList.toggle('hidden', !state.currentUser);
        renderFeed(els.feedList, state.posts);
    } else if (state.currentView === 'profile') {
        els.profileFeedView.classList.remove('hidden');
        renderSelectedUser();
        
        if (state.currentUser && state.currentUser.id === state.selectedUserId) {
            els.profilePanel.classList.remove('hidden');
            renderProfileForm();
        } else {
            els.profilePanel.classList.add('hidden');
        }

        const profilePosts = state.posts.filter(p => p.userId === state.selectedUserId);
        renderFeed(els.profileFeedList, profilePosts);
    } else if (state.currentView === 'admin') {
        els.adminDashboardView.classList.remove('hidden');
        renderAdmin();
    } else if (state.currentView === 'friends') {
        els.friendsView.classList.remove('hidden');
        renderFriends();
    } else if (state.currentView === 'messages') {
        els.messagesView.classList.remove('hidden');
        renderMessages();
    }
}

function renderHeader() {
    if (state.currentUser) {
        els.headerAvatar.textContent = state.currentUser.avatar;
        els.headerAvatar.style.background = "var(--fb-blue)";
        els.headerName.textContent = state.currentUser.name;
        els.composerAvatar.textContent = state.currentUser.avatar;
        
        els.friendsButton.classList.remove("hidden");
        els.messagesButton.classList.remove("hidden");
        
        const unreadRequests = state.friendRequests.filter(r => r.receiver_id === state.currentUser.id && r.status === 'pending');
        const friendsSvg = `<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`;
        if (unreadRequests.length > 0) {
            els.friendsButton.innerHTML = `${friendsSvg} <span style="position:absolute; top:2px; right:2px; background:red; width:8px; height:8px; border-radius:50%;"></span>`;
            els.friendsButton.style.position = 'relative';
        } else {
            els.friendsButton.innerHTML = friendsSvg;
        }

        els.adminButton.classList.toggle("hidden", !state.currentUser.isAdmin);
    } else {
        const userSvg = `<svg viewBox="0 0 24 24" style="width:24px; height:24px; fill:white;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
        els.headerAvatar.innerHTML = userSvg;
        els.headerAvatar.style.background = "#ccc";
        els.headerName.textContent = "Log In";
        els.composerAvatar.innerHTML = userSvg;
        els.friendsButton.classList.add("hidden");
        els.messagesButton.classList.add("hidden");
        els.adminButton.classList.add("hidden");
    }
}

function renderProfileForm() {
    if (!state.currentUser || !els.profileForm) return;
    const user = state.currentUser;
    for (const field of ["name", "surname", "city", "headline", "email", "phone", "bio"]) {
        if (els.profileForm.elements[field]) {
            els.profileForm.elements[field].value = user[field] || "";
        }
    }
}

function renderSelectedUser() {
    const user = state.users.find((item) => item.id === state.selectedUserId);
    if (!user) { els.selectedUser.innerHTML = "User not found."; return; }

    const isSelf = state.currentUser?.id === user.id;
    const isFriend = Boolean(state.currentUser?.friends?.includes(user.id));
    const fullUser = state.profileDetails[user.id] || (isSelf ? state.currentUser : user);
    
    let connectionMarkup = '';
    if (!isSelf && state.currentUser) {
        const req = state.friendRequests.find(r => 
            (r.sender_id === state.currentUser.id && r.receiver_id === user.id) ||
            (r.receiver_id === state.currentUser.id && r.sender_id === user.id)
        );
        
        if (isFriend) {
            connectionMarkup = `<button class="primary-btn" onclick="openChat(${user.id})" style="margin-top: 10px; width: 100%; background: #42b72a;">&#128172; Message</button>`;
        } else if (req && req.status === 'pending') {
            if (req.sender_id === state.currentUser.id) {
                connectionMarkup = `<button class="chip-button" disabled style="margin-top: 10px; width: 100%; cursor:not-allowed;">Request Sent</button>`;
            } else {
                connectionMarkup = `
                    <div style="display:flex; gap:10px; margin-top: 10px;">
                        <button class="primary-btn" onclick="respondFriendRequest(${req.id}, true)" style="flex:1;">Accept Request</button>
                        <button class="chip-button" onclick="respondFriendRequest(${req.id}, false)" style="flex:1;">Reject</button>
                    </div>`;
            }
        } else {
            connectionMarkup = `<button class="primary-btn" onclick="addFriend(${user.id})" style="margin-top: 10px; width: 100%;">Add Friend</button>`;
        }
    }

    const privateMarkup = isSelf || isFriend
        ? `
            <div><strong>Email</strong><span>${escapeHtml(fullUser.email || "...")}</span></div>
            <div><strong>Phone</strong><span>${escapeHtml(fullUser.phone || "...")}</span></div>
            <div><strong>Bio</strong><span>${escapeHtml(fullUser.bio || "...")}</span></div>
        `
        : `<div><strong>Friends only</strong><span class="muted" style="font-size:0.8rem">Private details are reserved for friends.</span></div>`;

    els.selectedUser.innerHTML = `
        <div class="selected-card" style="margin-bottom: 0;">
            <div class="avatar large" style="background:var(--fb-blue);">${escapeHtml(user.avatar)}</div>
            <div class="info-grid">
                <div><strong>Name</strong><span>${escapeHtml(user.name)} ${escapeHtml(user.surname)}</span></div>
                <div><strong>City</strong><span>${escapeHtml(user.city)}</span></div>
                <div><strong>Headline</strong><span>${escapeHtml(user.headline)}</span></div>
                ${privateMarkup}
                <div style="grid-column: 1 / -1;">${connectionMarkup}</div>
            </div>
        </div>
    `;
}

function renderFriends() {
    if (!state.currentUser) return;
    const incoming = state.friendRequests.filter(r => r.receiver_id === state.currentUser.id && r.status === 'pending');
    
    if (incoming.length === 0) {
        els.friendRequestsList.innerHTML = `<p class="muted">No pending friend requests.</p>`;
        return;
    }
    
    els.friendRequestsList.innerHTML = incoming.map(req => `
        <div class="post-card" style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 10px;">
            <div class="author-wrap" onclick="selectUser(${req.sender_id})" style="cursor:pointer;">
                <div class="avatar">${escapeHtml(req.sender_avatar)}</div>
                <div>
                    <h3>${escapeHtml(req.sender_name)} ${escapeHtml(req.sender_surname)}</h3>
                    <div class="post-time">Sent a friend request</div>
                </div>
            </div>
            <div style="display:flex; gap: 8px;">
                <button class="primary-btn" onclick="respondFriendRequest(${req.id}, true)">Accept</button>
                <button class="chip-button" onclick="respondFriendRequest(${req.id}, false)">Reject</button>
            </div>
        </div>
    `).join("");
}

function renderMessages() {
    if (!state.currentUser) return;
    
    const friends = state.currentUser.friends || [];
    const friendUsers = state.users.filter(u => friends.includes(u.id));
    
    if (friendUsers.length === 0) {
        els.messageFriendsList.innerHTML = `<p class="muted">You haven't added any friends yet.</p>`;
        return;
    }

    els.messageFriendsList.innerHTML = friendUsers.map(f => `
        <div class="search-result-item ${f.id === state.activeChatUserId ? 'active' : ''}" onclick="openChat(${f.id})" style="${f.id === state.activeChatUserId ? 'background: var(--soft);' : ''}">
            <div class="avatar">${escapeHtml(f.avatar)}</div>
            <div class="search-result-info">
                <strong>${escapeHtml(f.name)} ${escapeHtml(f.surname)}</strong>
            </div>
        </div>
    `).join("");

    if (!state.activeChatUserId) {
        els.activeChat.innerHTML = `<p class="muted" style="text-align: center; margin-top: 20px;">Select a friend to start chatting.</p>`;
        els.messageInput.disabled = true;
        els.messageSendBtn.disabled = true;
    } else {
        els.messageInput.disabled = false;
        els.messageSendBtn.disabled = false;
        
        if (state.activeChatMessages.length === 0) {
            els.activeChat.innerHTML = `<p class="muted" style="text-align: center; margin-top: 20px;">No messages yet. Say hi!</p>`;
        } else {
            els.activeChat.innerHTML = state.activeChatMessages.map(m => {
                const isMe = m.sender_id === state.currentUser.id;
                return `
                    <div style="display: flex; margin-bottom: 10px; justify-content: ${isMe ? 'flex-end' : 'flex-start'};">
                        <div style="max-width: 70%; background: ${isMe ? 'var(--fb-blue)' : '#e4e6eb'}; color: ${isMe ? 'white' : 'var(--ink)'}; padding: 8px 12px; border-radius: 18px;">
                            ${escapeHtml(m.body)}
                        </div>
                    </div>
                `;
            }).join("");
            els.activeChat.scrollTop = els.activeChat.scrollHeight;
        }
    }
}

function renderFeed(container, posts) {
    if (posts.length === 0) {
        container.innerHTML = `<p class="muted" style="text-align:center; padding: 40px 0;">No posts to show.</p>`;
        return;
    }

    container.innerHTML = posts.map((post) => {
        const canEditDeletePost = state.currentUser && (state.currentUser.id === post.userId || state.currentUser.isAdmin);

        return `
        <article class="post-card">
            <div class="post-top">
                <div class="author-wrap" onclick="selectUser(${post.userId})" style="cursor:pointer;">
                    <div class="avatar">${escapeHtml(post.avatar)}</div>
                    <div>
                        <h3>${escapeHtml(post.author)} ${escapeHtml(post.surname)}</h3>
                        <div class="post-time">${formatDate(post.createdAt)} · ${escapeHtml(post.city)}</div>
                    </div>
                </div>
                <div>
                    ${post.commentsLocked ? `<span class="badge lock">&#128274; Locked</span>` : ""}
                </div>
            </div>
            <p class="post-body">${escapeHtml(post.body)}</p>
            <div class="post-actions">
                <button class="chip-button ${post.liked ? "active" : ""}" data-like-post="${post.id}" type="button">
                    ${post.liked ? '&#128077;' : '&#128077;'} Like (${post.likeCount})
                </button>
                <button class="chip-button" type="button" onclick="document.querySelector('#comment-input-${post.id}')?.focus()">
                    &#128172; Comment (${post.comments.length})
                </button>
                ${canEditDeletePost ? `
                    <button class="chip-button" data-edit-post="${post.id}" type="button">&#9998; Edit</button>
                    <button class="chip-button danger" data-delete-post="${post.id}" type="button">&#10006; Delete</button>
                ` : ""}
            </div>
            <div class="comments">
                ${post.comments.map((comment) => {
                    const canEditDelete = state.currentUser && (state.currentUser.id === comment.userId || state.currentUser.isAdmin);
                    return `
                    <div class="comment">
                        <div class="avatar" onclick="selectUser(${comment.userId})" style="cursor:pointer;">${escapeHtml(comment.avatar)}</div>
                        <div style="flex:1;">
                            <div class="comment-bubble">
                                <strong onclick="selectUser(${comment.userId})" style="cursor:pointer;">${escapeHtml(comment.author)}</strong>
                                <p>${escapeHtml(comment.body)}</p>
                            </div>
                            ${canEditDelete ? `
                            <div class="comment-actions">
                                <span onclick="updateComment(${comment.id}, '${escapeHtml(comment.body).replace(/'/g, "\\'")}')">Edit</span>
                                <span onclick="deleteComment(${comment.id})">Delete</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `}).join("")}
            </div>
            ${state.currentUser ? `
            <form class="comment-form" data-comment-form="${post.id}">
                <div class="avatar">${escapeHtml(state.currentUser.avatar)}</div>
                <input id="comment-input-${post.id}" name="body" placeholder="${post.commentsLocked ? "Comments are locked" : "Write a comment..."}" ${post.commentsLocked ? "disabled" : ""} required autocomplete="off">
            </form>
            ` : ""}
        </article>
    `}).join("");

    container.querySelectorAll("[data-like-post]").forEach((button) => {
        button.addEventListener("click", () => toggleLike(Number(button.dataset.likePost)));
    });

    container.querySelectorAll("[data-delete-post]").forEach((button) => {
        button.addEventListener("click", () => deletePost(Number(button.dataset.deletePost)));
    });

    container.querySelectorAll("[data-edit-post]").forEach((button) => {
        button.addEventListener("click", () => {
            const postId = Number(button.dataset.editPost);
            const post = state.posts.find((p) => p.id === postId);
            if (!post) return;
            const body = prompt("Edit post:", post.body);
            if (body === null || body.trim() === "") return;
            const mood = prompt("Mood:", post.mood) ?? post.mood;
            updatePost(postId, body.trim(), mood.trim());
        });
    });

    container.querySelectorAll("[data-comment-form]").forEach((form) => {
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const postId = Number(form.dataset.commentForm);
            const body = String(new FormData(event.currentTarget).get("body") || "").trim();
            if (!body) return;
            addComment(postId, body);
            event.currentTarget.reset();
        });
    });
}

function renderAdmin() {
    if (!state.admin) return;
    
    const stats = state.admin.stats;
    const topPostsComments = [...state.posts].sort((a, b) => b.comments.length - a.comments.length).slice(0, 3);
    const topPostsLikes = [...state.posts].sort((a, b) => b.likeCount - a.likeCount).slice(0, 3);
    const users = state.admin.users || [];

    els.adminStats.innerHTML = `
        <div class="stats-grid">
            <div class="stat"><strong>${stats.users}</strong><span>Users</span></div>
            <div class="stat"><strong>${stats.posts}</strong><span>Posts</span></div>
            <div class="stat"><strong>${stats.comments}</strong><span>Comments</span></div>
            <div class="stat"><strong>${stats.likes}</strong><span>Likes</span></div>
        </div>
        
        <h3 style="margin-top: 20px;">Top Posts by Comments</h3>
        <div style="margin-bottom: 16px;">
            ${topPostsComments.map((p) => `
                <div class="log-row">
                    <strong style="max-width:60%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.body)}</strong>
                    <span class="muted">${p.comments.length} comments</span>
                </div>
            `).join("") || `<p class="muted">No posts.</p>`}
        </div>
        
        <h3 style="margin-top: 20px;">Top Posts by Likes</h3>
        <div style="margin-bottom: 16px;">
            ${topPostsLikes.map((p) => `
                <div class="log-row">
                    <strong style="max-width:60%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.body)}</strong>
                    <span class="muted">${p.likeCount} likes</span>
                </div>
            `).join("") || `<p class="muted">No posts.</p>`}
        </div>
        
        <h3 style="margin-top: 20px;">All Users List</h3>
        <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 8px;">
            ${users.map(u => `
                <div style="display:flex; justify-content:space-between; padding: 4px 0; border-bottom: 1px solid var(--soft);">
                    <span><strong>${escapeHtml(u.name)} ${escapeHtml(u.surname)}</strong></span>
                    <span class="muted" style="font-size:0.8rem; cursor:pointer;" onclick="selectUser(${u.id})">View Profile</span>
                </div>
            `).join('')}
        </div>
    `;

    const recent = state.admin.recent || [];
    els.adminLog.innerHTML = recent.length
        ? `<h3 style="margin-top: 20px;">Recent Activity</h3>` + recent.map((row) => {
            const who = row.username ? escapeHtml(row.username) : "system";
            return `<div class="log-row"><strong>${escapeHtml(row.type)}</strong><span class="muted">${formatDate(row.created_at)} by ${who}</span></div>`;
        }).join("")
        : `<p class="muted">No activity yet.</p>`;
}

function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value.replace(" ", "T")));
}

function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
