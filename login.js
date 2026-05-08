const API = "../back-end/api.php";

const els = {
    loginForm: document.querySelector("#loginForm"),
    loginMessage: document.querySelector("#loginMessage")
};

document.addEventListener("DOMContentLoaded", init);
els.loginForm.addEventListener("submit", login);

async function init() {
    // If already logged in, redirect to index
    const currentUser = JSON.parse(localStorage.getItem("mosais:user") || "null");
    if (currentUser) {
        window.location.href = "index.html";
    }
}

async function login(event) {
    event.preventDefault();

    els.loginMessage.textContent = "Checking your Mosais account...";
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");

    try {
        const response = await fetch(`${API}?action=login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (!response.ok) {
            els.loginMessage.textContent = data.error || "Unable to sign in.";
            return;
        }

        localStorage.setItem("mosais:user", JSON.stringify(data.user));
        window.location.href = "index.html";
    } catch (error) {
        els.loginMessage.textContent = "API error. Ensure the PHP server is running.";
        console.error(error);
    }
}
