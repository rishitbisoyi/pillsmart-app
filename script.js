document.addEventListener('DOMContentLoaded', () => {

    const BACKEND_URL = '';
    const DEFAULT_RINGTONE_URL = "alarm.mp3";

    let slots = [];
    let dispenseLogs = [];
    let userDetails = {
        name: "",
        email: "",
        phone: "",
        profile_pic: "",
        custom_ringtone: ""
    };

    let activePage = "dashboard";

    const authPage = document.getElementById("authPage");
    const appContainer = document.getElementById("appContainer");
    const pageContent = document.getElementById("page-content");
    const pageTitle = document.getElementById("page-title");
    const avatarDiv = document.getElementById("profile-avatar");
    const toast = document.getElementById("toast");

    /* ================== UTILITIES ================== */

    function showToast(msg, type="success") {
        toast.textContent = msg;
        toast.className =
            `fixed top-4 right-4 text-white px-4 py-2 rounded shadow-lg z-50
            ${type === "success" ? "bg-teal-500" : "bg-red-500"}`;
        toast.classList.remove("hidden");
        setTimeout(() => toast.classList.add("hidden"), 3000);
    }

    const getToken = () =>
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken");

    function saveAuth(token, name, email, remember) {
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem("authToken", token);
        storage.setItem("userName", name);
        storage.setItem("userEmail", email);
    }

    function logout() {
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
    }

    async function apiCall(endpoint, method="GET", body=null) {
        try {
            const token = getToken();

            const res = await fetch(`${BACKEND_URL}${endpoint}`, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: body ? JSON.stringify(body) : null
            });

            if (!res.ok) return { success:false };
            return await res.json();

        } catch(err) {
            console.error(err);
            return { success:false };
        }
    }

    /* ================= NAVIGATION ================= */

    const navItems = [
        {id:"dashboard",name:"Dashboard"},
        {id:"schedule",name:"Dispenser Manager"},
        {id:"logs",name:"Logs"},
        {id:"alerts",name:"Alerts"}
    ];

    function renderNav() {
        const sidebar = document.getElementById("sidebar-nav");
        const bottom = document.getElementById("bottom-nav");

        sidebar.innerHTML = "";
        bottom.innerHTML = "";

        navItems.forEach(n => {
            sidebar.innerHTML +=
                `<a href="#" data-page="${n.id}"
                  class="nav-link block px-6 py-3 hover:bg-gray-100">
                  ${n.name}
                </a>`;

            bottom.innerHTML +=
                `<a href="#" data-page="${n.id}"
                  class="nav-link flex-1 text-center py-2 text-sm">
                  ${n.name}
                </a>`;
        });
    }

    /* ================= DASHBOARD ================= */

    function renderDashboard() {

        const totalMeds = slots.length;
        const totalSchedules =
            slots.reduce((acc,s)=>acc + (s.schedules?.length||0),0);

        return `
        <div class="grid md:grid-cols-3 gap-6">

            <div class="bg-white p-6 rounded-xl shadow">
                <h3 class="font-semibold text-gray-500">Total Slots</h3>
                <p class="text-3xl font-bold">${totalMeds}</p>
            </div>

            <div class="bg-white p-6 rounded-xl shadow">
                <h3 class="font-semibold text-gray-500">Total Schedules</h3>
                <p class="text-3xl font-bold">${totalSchedules}</p>
            </div>

            <div class="bg-white p-6 rounded-xl shadow">
                <h3 class="font-semibold text-gray-500">Recent Logs</h3>
                <p class="text-sm text-gray-600">
                    ${dispenseLogs[0]?.medicine_name || "No logs yet"}
                </p>
            </div>

        </div>`;
    }

    /* ================= SCHEDULE ================= */

    function renderSchedule() {

        return `
        <div class="space-y-6">
            ${slots.map(slot=>`
                <div class="bg-white p-6 rounded-xl shadow space-y-3">
                    <h3 class="font-bold">Slot ${slot.slot_number}</h3>

                    <input data-slot="${slot.slot_number}"
                           class="slot-name border p-2 w-full rounded"
                           placeholder="Medicine Name"
                           value="${slot.medicine_name || ""}">

                    <input data-slot="${slot.slot_number}"
                           type="number"
                           class="slot-tablets border p-2 w-full rounded"
                           placeholder="Total Tablets"
                           value="${slot.total_tablets || 0}">

                    <button data-slot="${slot.slot_number}"
                            class="save-slot bg-teal-600 text-white px-4 py-2 rounded">
                        Save Slot
                    </button>
                </div>
            `).join("")}
        </div>`;
    }

    /* ================= LOGS ================= */

    function renderLogs() {
        return `
        <div class="bg-white p-6 rounded-xl shadow">
            <h2 class="font-bold mb-4">Dispense Logs</h2>
            ${dispenseLogs.length === 0 ?
                "<p>No logs yet.</p>" :
                dispenseLogs.map(l=>`
                    <div class="border p-3 mb-2 rounded">
                        Slot ${l.slot_number} - ${l.medicine_name}
                        <div class="text-sm text-gray-500">${l.time}</div>
                    </div>
                `).join("")
            }
        </div>`;
    }

    /* ================= ALERTS ================= */

    function renderAlerts() {
        return `
        <div class="bg-white p-6 rounded-xl shadow space-y-4">
            <h2 class="font-bold">Alarm Settings</h2>

            <input type="file" id="alarm-upload" accept="audio/*"
                   class="border p-2 w-full rounded">

            <button id="test-alarm"
                    class="bg-blue-600 text-white px-4 py-2 rounded">
                Test Alarm
            </button>
        </div>`;
    }

    /* ================= PROFILE ================= */

    function renderProfile() {

        return `
        <div class="bg-white p-8 rounded-xl shadow max-w-xl space-y-6">

            <div class="flex flex-col items-center space-y-2">

                <div id="profile-preview"
                     class="h-24 w-24 rounded-full bg-teal-500 text-white
                            flex items-center justify-center text-2xl font-bold overflow-hidden cursor-pointer">
                    ${userDetails.profile_pic ?
                        `<img src="${userDetails.profile_pic}"
                              class="h-full w-full object-cover">`
                        :
                        (userDetails.name||"U")
                            .split(" ")
                            .map(n=>n[0])
                            .join("")
                            .substring(0,2)
                            .toUpperCase()
                    }
                </div>

                <input type="file" id="profile-upload"
                       accept="image/*" class="hidden">

            </div>

            <input id="prof-name"
                   class="w-full border p-2 rounded"
                   value="${userDetails.name}">

            <input id="prof-phone"
                   class="w-full border p-2 rounded"
                   value="${userDetails.phone}">

            <input id="new-password"
                   type="password"
                   class="w-full border p-2 rounded"
                   placeholder="New Password">

            <button id="save-profile-btn"
                    class="bg-teal-600 text-white px-4 py-2 rounded w-full">
                Save Changes
            </button>

        </div>`;
    }

    /* ================= PAGE ROUTER ================= */

    function showPage(page) {
        activePage = page;
        pageTitle.textContent =
            navItems.find(n=>n.id===page)?.name || "Dashboard";

        if(page==="dashboard") pageContent.innerHTML = renderDashboard();
        if(page==="schedule") pageContent.innerHTML = renderSchedule();
        if(page==="logs") pageContent.innerHTML = renderLogs();
        if(page==="alerts") pageContent.innerHTML = renderAlerts();
        if(page==="profile") pageContent.innerHTML = renderProfile();
    }

    /* ================= EVENTS ================= */

    document.body.addEventListener("click", async e => {

        if(e.target.closest("#logout-btn")) logout();

        if(e.target.closest("#profile-avatar"))
            showPage("profile");

        if(e.target.closest(".nav-link")) {
            e.preventDefault();
            showPage(e.target.dataset.page);
        }

        if(e.target.closest("#save-profile-btn")) {

            const payload = {
                name: document.getElementById("prof-name").value,
                phone: document.getElementById("prof-phone").value
            };

            const newPass = document.getElementById("new-password").value;
            if(newPass) payload.new_password = newPass;

            const res = await apiCall("/update_profile","POST",payload);

            if(res.success) showToast("Profile Updated");
            else showToast("Update Failed","error");
        }

        if(e.target.closest("#test-alarm")) {
            const audio = new Audio(
                userDetails.custom_ringtone || DEFAULT_RINGTONE_URL
            );
            audio.play();
        }
    });

    /* ================= INIT ================= */

    async function init() {

        if(getToken()) {

            authPage.classList.add("page-hidden");
            appContainer.classList.remove("page-hidden");

            renderNav();

            const profile = await apiCall("/get_profile");
            const logs = await apiCall("/get_logs");
            const inventory = await apiCall("/get_inventory");

            if(profile?.name) userDetails = profile;
            if(Array.isArray(logs)) dispenseLogs = logs;
            if(Array.isArray(inventory)) slots = inventory;

            showPage("dashboard");

        } else {
            appContainer.classList.add("page-hidden");
            authPage.classList.remove("page-hidden");
        }
    }

    init();
});
