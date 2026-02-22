document.addEventListener('DOMContentLoaded', () => {

    const BACKEND_URL = '';
    const DEFAULT_RINGTONE_URL = "alarm.mp3";
    const LOW_STOCK_THRESHOLD = 5;

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
    const toast = document.getElementById("toast");

    /* ================= UTIL ================= */

    function showToast(msg, type="success") {
        if(!toast) return;
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

    function logout() {
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
    }

    /* ===== FIXED API ===== */

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

            const data = await res.json();
            return data;

        } catch(err) {
            console.error(err);
            return { success:false };
        }
    }

    /* ================= NAV ================= */

    const navItems = [
        {id:"dashboard",name:"Dashboard"},
        {id:"schedule",name:"Dispenser Manager"},
        {id:"logs",name:"Logs"},
        {id:"alerts",name:"Alerts"},
        {id:"profile",name:"Profile"}
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

    function getNextDose() {

        const now = new Date();
        let upcoming = null;

        slots.forEach(slot => {

            if(!slot.medicine_name || slot.tablets_left <= 0) return;

            (slot.schedules || []).forEach(s => {

                if(!s.time) return;

                const [h,m] = s.time.split(":").map(Number);

                let doseTime = new Date();
                doseTime.setHours(h, m, 0, 0);

                if(doseTime <= now) {
                    doseTime.setDate(doseTime.getDate() + 1);
                }

                if(!upcoming || doseTime < upcoming.time) {
                    upcoming = {
                        time: doseTime,
                        medicine: slot.medicine_name,
                        dosage: s.dosage
                    };
                }

            });

        });

        return upcoming;
    }

    function renderDashboard() {

        const totalSchedules =
            slots.reduce((a,s)=>a+(s.schedules?.length||0),0);

        const next = getNextDose();

        return `
        <div class="space-y-6">

            <h2 class="text-2xl font-bold">Dashboard</h2>

            <div class="grid md:grid-cols-3 gap-6">

                <div class="bg-white p-6 rounded-xl shadow">
                    <h3 class="text-gray-500">Total Slots</h3>
                    <p class="text-3xl font-bold">${slots.length}</p>
                </div>

                <div class="bg-white p-6 rounded-xl shadow">
                    <h3 class="text-gray-500">Total Schedules</h3>
                    <p class="text-3xl font-bold">${totalSchedules}</p>
                </div>

                <div class="bg-white p-6 rounded-xl shadow">
                    <h3 class="text-gray-500">Next Dose</h3>
                    <p>
                        ${next ? 
                            `${next.medicine} (${next.dosage}) at ${next.time.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`
                            : "No upcoming dose"}
                    </p>
                </div>

            </div>
        </div>`;
    }

    /* ================= LOGS ================= */

    function renderLogs() {
        return `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold">Dispense Logs</h2>
            <div class="bg-white p-6 rounded-xl shadow">
                ${
                    dispenseLogs.length === 0
                    ? "No logs yet"
                    : dispenseLogs.map(l=>`
                        <div class="border-b py-2">
                            ${l.medicine_name} - ${l.dosage}
                            <div class="text-sm text-gray-500">${l.time}</div>
                        </div>
                    `).join("")
                }
            </div>
        </div>`;
    }

    /* ================= ALERTS ================= */

    function renderAlerts() {
        return `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold">Alarm Settings</h2>
            <div class="bg-white p-6 rounded-xl shadow space-y-4">
                <input type="file" id="alarm-upload" accept="audio/*"
                       class="border p-2 w-full rounded">
                <button id="test-alarm"
                        class="bg-blue-600 text-white px-4 py-2 rounded">
                    Test Alarm
                </button>
            </div>
        </div>`;
    }

    /* ================= PROFILE ================= */

    function renderProfile() {

        return `
        <div class="flex justify-center">

            <div class="bg-white p-10 rounded-2xl shadow-lg w-full max-w-xl space-y-6">

                <h2 class="text-2xl font-bold text-center">Profile Settings</h2>

                <div class="flex flex-col items-center space-y-3">

                    <div id="profile-preview"
                         class="h-28 w-28 rounded-full bg-teal-500 text-white 
                                flex items-center justify-center text-3xl font-bold 
                                overflow-hidden cursor-pointer shadow-md">

                        ${userDetails.profile_pic ?
                            `<img src="${userDetails.profile_pic}" class="h-full w-full object-cover">`
                            :
                            (userDetails.name || "U")
                                .split(" ")
                                .map(n => n[0])
                                .join("")
                                .substring(0,2)
                                .toUpperCase()
                        }

                    </div>

                    <input type="file" id="profile-upload" accept="image/*" class="hidden">

                </div>

                <div>
                    <label>Name</label>
                    <input id="prof-name" class="w-full border p-2 rounded"
                           value="${userDetails.name || ""}">
                </div>

                <div>
                    <label>Email</label>
                    <input class="w-full border p-2 rounded bg-gray-100"
                           value="${userDetails.email || ""}" disabled>
                </div>

                <div>
                    <label>Phone</label>
                    <input id="prof-phone" class="w-full border p-2 rounded"
                           value="${userDetails.phone || ""}">
                </div>

                <div class="space-y-2">
                    <label>Change Password</label>
                    <input id="new-password" type="password"
                           class="w-full border p-2 rounded"
                           placeholder="New Password">

                    <input id="confirm-password" type="password"
                           class="w-full border p-2 rounded"
                           placeholder="Confirm Password">
                </div>

                <button id="save-profile-btn"
                        class="bg-teal-600 text-white px-4 py-2 rounded w-full">
                    Save Changes
                </button>

            </div>
        </div>`;
    }

    /* ================= ROUTER ================= */

    function showPage(page) {
        activePage = page;
        pageTitle.textContent =
            navItems.find(n=>n.id===page)?.name || "Dashboard";

        if(page==="dashboard") pageContent.innerHTML = renderDashboard();
        if(page==="logs") pageContent.innerHTML = renderLogs();
        if(page==="alerts") pageContent.innerHTML = renderAlerts();
        if(page==="profile") pageContent.innerHTML = renderProfile();
    }

    /* ================= EVENTS ================= */

    document.body.addEventListener("click", async e => {

        if(e.target.closest("#logout-btn")) logout();

        if(e.target.closest(".nav-link")) {
            e.preventDefault();
            showPage(e.target.dataset.page);
        }

        if(e.target.closest("#profile-preview")) {
            document.getElementById("profile-upload").click();
        }

        if(e.target.closest("#save-profile-btn")) {

            const name = document.getElementById("prof-name").value.trim();
            const phone = document.getElementById("prof-phone").value.trim();
            const pass = document.getElementById("new-password").value;
            const confirm = document.getElementById("confirm-password").value;

            if(pass && pass !== confirm) {
                showToast("Passwords do not match ❌","error");
                return;
            }

            let payload = { name, phone, profile_pic: userDetails.profile_pic };
            if(pass) payload.new_password = pass;

            const res = await apiCall("/update_profile","POST",payload);

            if(res && res.success === true) {
                showToast("Profile Updated Successfully ✅");
            } else {
                showToast("Update Failed ❌","error");
            }
        }

        if(e.target.closest("#test-alarm")) {
            const audio =
                new Audio(userDetails.custom_ringtone || DEFAULT_RINGTONE_URL);
            audio.play();
        }

    });

    document.addEventListener("change", function(e) {

        if(e.target.id === "profile-upload") {

            const file = e.target.files[0];
            if(!file) return;

            const reader = new FileReader();

            reader.onload = function(event) {
                userDetails.profile_pic = event.target.result;
                document.getElementById("profile-preview").innerHTML =
                    `<img src="${event.target.result}" class="h-full w-full object-cover">`;
            };

            reader.readAsDataURL(file);
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
