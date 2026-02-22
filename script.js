document.addEventListener('DOMContentLoaded', () => {

    /* ================= CONFIG ================= */

    const BACKEND_URL = " "; // 🔥 CHANGE if needed

    let slots = [];
    let dispenseLogs = [];
    let userDetails = { name: "", email: "", phone: "", profile_pic: "" };
    let activePage = 'dashboard';

    /* ================= DOM ELEMENTS ================= */

    const authPage = document.getElementById('authPage');
    const appContainer = document.getElementById('appContainer');
    const loginContainer = document.getElementById('login-form-container');
    const signupContainer = document.getElementById('signup-form-container');
    const forgotContainer = document.getElementById('forgot-password-container');
    const pageContent = document.getElementById('page-content');
    const pageTitle = document.getElementById('page-title');
    const avatarDiv = document.getElementById('profile-avatar');
    const toast = document.getElementById('toast');

    /* ================= SAFE TOAST ================= */

    function showToast(msg, type = 'success') {
        if (!toast) return;

        toast.textContent = msg;
        toast.className = `fixed top-4 right-4 text-white px-4 py-2 rounded shadow-lg z-50 ${
            type === 'success' ? 'bg-teal-500' : 'bg-red-500'
        }`;

        toast.classList.remove('hidden');

        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    /* ================= TOKEN ================= */

    const getAuthToken = () =>
        localStorage.getItem('authToken') ||
        sessionStorage.getItem('authToken');

    function saveAuth(token, name, email, remember) {
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem('authToken', token);
        storage.setItem('userName', name);
        storage.setItem('userEmail', email);
    }

    function performLogout() {
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
    }

    /* ================= SAFE API ================= */

    async function apiCall(endpoint, method = 'GET', body = null) {
        try {
            const token = getAuthToken();

            const res = await fetch(`${BACKEND_URL}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: body ? JSON.stringify(body) : null
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.warn("API error:", res.status, errorText);
                return { success: false };
            }

            return await res.json();

        } catch (err) {
            console.error("API FAILURE:", err);
            return { success: false };
        }
    }

    /* ================= AUTH SWITCH ================= */

    document.getElementById('show-signup-link')?.addEventListener('click', e => {
        e.preventDefault();
        loginContainer?.classList.add('page-hidden');
        signupContainer?.classList.remove('page-hidden');
        forgotContainer?.classList.add('page-hidden');
    });

    document.getElementById('show-login-link')?.addEventListener('click', e => {
        e.preventDefault();
        signupContainer?.classList.add('page-hidden');
        loginContainer?.classList.remove('page-hidden');
        forgotContainer?.classList.add('page-hidden');
    });

    document.getElementById('forgot-password-link')?.addEventListener('click', e => {
        e.preventDefault();
        loginContainer?.classList.add('page-hidden');
        signupContainer?.classList.add('page-hidden');
        forgotContainer?.classList.remove('page-hidden');
    });

    document.getElementById('back-to-login-link')?.addEventListener('click', e => {
        e.preventDefault();
        forgotContainer?.classList.add('page-hidden');
        loginContainer?.classList.remove('page-hidden');
    });

    /* ================= LOGIN ================= */

    document.getElementById('login-form')?.addEventListener('submit', async e => {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const remember = document.getElementById('rememberMe')?.checked;

        const res = await apiCall('/login', 'POST', { email, password });

        if (res.success) {
            saveAuth(res.token, res.name, res.email, remember);
            location.reload();
        } else {
            showToast(res.error || "Login Failed", 'error');
        }
    });

    /* ================= SIGNUP ================= */

    document.getElementById('signup-form')?.addEventListener('submit', async e => {
        e.preventDefault();

        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        const res = await apiCall('/register', 'POST', { name, email, password });

        if (res.success) {
            showToast("Registered Successfully");
            signupContainer?.classList.add('page-hidden');
            loginContainer?.classList.remove('page-hidden');
        } else {
            showToast(res.error || "Registration Failed", 'error');
        }
    });

    /* ================= PROFILE ================= */

    function updateAvatar() {
        if (!avatarDiv) return;

        if (userDetails.profile_pic) {
            avatarDiv.innerHTML = `
                <img src="${userDetails.profile_pic}"
                     class="h-10 w-10 rounded-full object-cover">
            `;
        } else {
            const initials = (userDetails.name || "U")
                .split(" ")
                .map(n => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();

            avatarDiv.innerHTML = `
                <div class="h-10 w-10 flex items-center justify-center 
                            bg-gray-500 text-white rounded-full font-semibold">
                    ${initials}
                </div>
            `;
        }
    }

    function renderProfile() {
        return `
        <div class="dashboard-card p-8 max-w-2xl space-y-6 bg-white rounded-xl shadow">

            <div>
                <label class="font-semibold block mb-1">Full Name</label>
                <input id="prof-name" class="w-full p-2 border rounded"
                       value="${userDetails.name || ''}">
            </div>

            <div>
                <label class="font-semibold block mb-1">Phone</label>
                <input id="prof-phone" class="w-full p-2 border rounded"
                       value="${userDetails.phone || ''}">
            </div>

            <div>
                <label class="font-semibold block mb-1">New Password</label>
                <input type="password" id="new-password"
                       class="w-full p-2 border rounded">
            </div>

            <button id="save-profile-btn"
                    class="bg-teal-500 text-white px-4 py-2 rounded w-full">
                Save Changes
            </button>

        </div>`;
    }

    function showPage(page) {
        activePage = page;

        if (page === 'profile') {
            pageTitle.textContent = "Profile";
            pageContent.innerHTML = renderProfile();
            return;
        }

        pageTitle.textContent = "Dashboard";
        pageContent.innerHTML = `
            <div class="dashboard-card p-6 bg-white rounded-xl shadow">
                Welcome ${userDetails.name || "User"}
            </div>`;
    }

    document.body.addEventListener('click', async e => {

        if (e.target.closest('#logout-btn')) performLogout();

        if (e.target.closest('#profile-avatar'))
            showPage('profile');

        if (e.target.closest('#save-profile-btn')) {

            const payload = {
                name: document.getElementById('prof-name').value,
                phone: document.getElementById('prof-phone').value
            };

            const newPass = document.getElementById('new-password').value;
            if (newPass) payload.new_password = newPass;

            const res = await apiCall('/update_profile', 'POST', payload);

            if (res.success) {
                userDetails.name = payload.name;
                userDetails.phone = payload.phone;

                updateAvatar();
                showPage('dashboard');
                showToast("Profile Updated Successfully");
            } else {
                showToast("Update Failed", 'error');
            }
        }
    });

    /* ================= REFRESH ================= */

    async function refreshData() {
        try {
            const profile = await apiCall('/get_profile');

            if (profile?.name) {
                userDetails = profile;
                updateAvatar();
                showPage('dashboard');
            }

        } catch (err) {
            console.error("Refresh failed:", err);
        }
    }

    /* ================= INIT ================= */

    if (getAuthToken()) {
        authPage?.classList.add('page-hidden');
        appContainer?.classList.remove('page-hidden');
        refreshData();
    } else {
        appContainer?.classList.add('page-hidden');
        authPage?.classList.remove('page-hidden');
    }

});
