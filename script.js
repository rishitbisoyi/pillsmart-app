document.addEventListener('DOMContentLoaded', () => {

    const BACKEND_URL = '';
    const DEFAULT_RINGTONE_URL = "alarm.mp3";
    const LOW_STOCK_THRESHOLD = 5;

    /* ── initialise 8 empty slots if backend returns nothing ── */
    function buildDefaultSlots() {
        return Array.from({ length: 8 }, (_, i) => ({
            slot_number: i + 1,
            medicine_name: "",
            total_tablets: 0,
            tablets_left: 0,
            schedules: []
        }));
    }

    let slots = buildDefaultSlots();
    let dispenseLogs = [];
    let userDetails = {
        name: "",
        email: "",
        phone: "",
        profile_pic: "",
        custom_ringtone: ""
    };

    let activePage = "dashboard";

    const authPage      = document.getElementById("authPage");
    const appContainer  = document.getElementById("appContainer");
    const pageContent   = document.getElementById("page-content");
    const pageTitle     = document.getElementById("page-title");
    const toast         = document.getElementById("toast");

    /* ═══════════════════ UTIL ═══════════════════ */

    function showToast(msg, type = "success") {
        if (!toast) return;
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

    /* ═══════════════════ API ═══════════════════ */

    async function apiCall(endpoint, method = "GET", body = null) {
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
            return await res.json();
        } catch (err) {
            console.error(err);
            return { success: false };
        }
    }

    /* ═══════════════════ NAV ═══════════════════ */

    const navItems = [
        { id: "dashboard", name: "Dashboard" },
        { id: "schedule",  name: "Schedule Inventory" },
        { id: "logs",      name: "Logs" },
        { id: "alerts",    name: "Alerts" },
        { id: "profile",   name: "Profile" }
    ];

    function renderNav() {
        const sidebar = document.getElementById("sidebar-nav");
        const bottom  = document.getElementById("bottom-nav");
        sidebar.innerHTML = "";
        bottom.innerHTML  = "";

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

    /* ═══════════════════ DASHBOARD ═══════════════════ */

    function getNextDose() {
        const now = new Date();
        let upcoming = null;

        slots.forEach(slot => {
            if (!slot.medicine_name || slot.tablets_left <= 0) return;
            (slot.schedules || []).forEach(s => {
                if (!s.time) return;
                const [h, m] = s.time.split(":").map(Number);
                let doseTime = new Date();
                doseTime.setHours(h, m, 0, 0);
                if (doseTime <= now) doseTime.setDate(doseTime.getDate() + 1);
                if (!upcoming || doseTime < upcoming.time) {
                    upcoming = { time: doseTime, medicine: slot.medicine_name, dosage: s.dosage };
                }
            });
        });

        return upcoming;
    }

    function renderDashboard() {
        const totalSchedules = slots.reduce((a, s) => a + (s.schedules?.length || 0), 0);
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
                    <p>${next
                        ? `${next.medicine} (${next.dosage}) at ${next.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "No upcoming dose"}</p>
                </div>
            </div>
        </div>`;
    }

    /* ═══════════════════ SCHEDULE (8 slots) ═══════════════════ */

    function renderSchedule() {
        return `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold">Schedule Inventory</h2>
            <div class="grid md:grid-cols-2 gap-6">
                ${slots.map(slot => renderSlotCard(slot)).join("")}
            </div>
        </div>`;
    }

    function renderSlotCard(slot) {
        const lowStock = slot.tablets_left > 0 && slot.tablets_left <= LOW_STOCK_THRESHOLD;
        const scheduleRows = (slot.schedules || [])
            .map((sch, i) => `
                <div class="flex items-center gap-2 schedule-row">
                    <input type="time"
                           data-slot="${slot.slot_number}"
                           data-index="${i}"
                           class="schedule-time border p-2 rounded flex-1 text-sm"
                           value="${sch.time || "09:00"}">

                    <input type="number"
                           data-slot="${slot.slot_number}"
                           data-index="${i}"
                           class="schedule-dosage border p-2 rounded w-20 text-sm"
                           placeholder="Dose"
                           min="1"
                           value="${sch.dosage || 1}">

                    <span class="text-xs text-gray-400">tab</span>

                    <button data-slot="${slot.slot_number}"
                            data-index="${i}"
                            class="remove-time text-red-500 hover:text-red-700 font-bold text-lg leading-none"
                            title="Remove this schedule">
                        ✕
                    </button>
                </div>
            `).join("");

        return `
        <div class="bg-white p-6 rounded-xl shadow space-y-4
             ${lowStock ? "border-2 border-red-400" : "border border-gray-200"}">

            <!-- Slot Header -->
            <div class="flex items-center justify-between">
                <h3 class="font-bold text-lg text-teal-700">Slot ${slot.slot_number}</h3>
                ${lowStock
                    ? `<span class="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">
                           ⚠ Low Stock (${slot.tablets_left} left)
                       </span>`
                    : slot.tablets_left > 0
                        ? `<span class="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">
                               ${slot.tablets_left} remaining
                           </span>`
                        : `<span class="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Empty</span>`
                }
            </div>

            <!-- Medicine Name -->
            <div>
                <label class="block text-sm font-medium text-gray-600 mb-1">Medicine Name</label>
                <input data-slot="${slot.slot_number}"
                       class="slot-name border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-teal-400"
                       placeholder="e.g. Paracetamol 500mg"
                       value="${slot.medicine_name || ""}">
            </div>

            <!-- Total Tablets -->
            <div>
                <label class="block text-sm font-medium text-gray-600 mb-1">Total Tablets</label>
                <input data-slot="${slot.slot_number}"
                       type="number"
                       min="0"
                       class="slot-tablets border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-teal-400"
                       placeholder="e.g. 30"
                       value="${slot.total_tablets || ""}">
            </div>

            <!-- Schedules -->
            <div>
                <label class="block text-sm font-medium text-gray-600 mb-2">
                    Schedules
                    <span class="ml-1 text-xs text-gray-400">(Time + Dosage per schedule)</span>
                </label>

                <div class="space-y-2" id="schedules-slot-${slot.slot_number}">
                    ${scheduleRows || `<p class="text-sm text-gray-400 italic">No schedules added yet.</p>`}
                </div>

                <button data-slot="${slot.slot_number}"
                        class="add-time mt-3 flex items-center gap-1 text-teal-600 hover:text-teal-800 text-sm font-medium">
                    <span class="text-lg font-bold leading-none">+</span> Add Schedule
                </button>
            </div>

            <!-- Save -->
            <button data-slot="${slot.slot_number}"
                    class="save-slot w-full bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded font-medium transition-colors">
                Save Slot ${slot.slot_number}
            </button>

        </div>`;
    }

    /* ═══════════════════ LOGS ═══════════════════ */

    function renderLogs() {
        return `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold">Dispense Logs</h2>
            <div class="bg-white p-6 rounded-xl shadow">
                ${dispenseLogs.length === 0
                    ? `<p class="text-gray-500 text-sm">No logs yet.</p>`
                    : dispenseLogs.map(l => `
                        <div class="border-b py-2">
                            <span class="font-medium">${l.medicine_name}</span>
                            — ${l.dosage} tablet(s)
                            <div class="text-sm text-gray-500">${l.time}</div>
                        </div>
                    `).join("")
                }
            </div>
        </div>`;
    }

    /* ═══════════════════ ALERTS ═══════════════════ */

    function renderAlerts() {
        return `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold">Alarm Settings</h2>
            <div class="bg-white p-6 rounded-xl shadow space-y-4">
                <label class="block text-sm font-medium text-gray-600">
                    Upload Custom Ringtone
                </label>
                <input type="file" id="alarm-upload" accept="audio/*"
                       class="border p-2 w-full rounded">
                <button id="test-alarm"
                        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors">
                    ▶ Test Alarm
                </button>
            </div>
        </div>`;
    }

    /* ═══════════════════ PROFILE ═══════════════════ */

    function renderProfile() {
        const initials = (userDetails.name || "U")
            .split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

        return `
        <div class="flex justify-center">
            <div class="bg-white p-10 rounded-2xl shadow-lg w-full max-w-xl space-y-6">
                <h2 class="text-2xl font-bold text-center">Profile Settings</h2>

                <div class="flex flex-col items-center space-y-3">
                    <div id="profile-preview"
                         class="h-28 w-28 rounded-full bg-teal-500 text-white
                                flex items-center justify-center text-3xl font-bold
                                overflow-hidden cursor-pointer shadow-md">
                        ${userDetails.profile_pic
                            ? `<img src="${userDetails.profile_pic}" class="h-full w-full object-cover">`
                            : initials
                        }
                    </div>
                    <input type="file" id="profile-upload" accept="image/*" class="hidden">
                    <p class="text-xs text-gray-400">Click avatar to change photo</p>
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1">Name</label>
                    <input id="prof-name" class="w-full border p-2 rounded"
                           value="${userDetails.name || ""}">
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1">Email</label>
                    <input class="w-full border p-2 rounded bg-gray-100"
                           value="${userDetails.email || ""}" disabled>
                </div>

                <div>
                    <label class="block text-sm font-medium mb-1">Phone</label>
                    <input id="prof-phone" class="w-full border p-2 rounded"
                           value="${userDetails.phone || ""}">
                </div>

                <div class="space-y-2">
                    <label class="block text-sm font-medium">Change Password</label>
                    <input id="new-password" type="password"
                           class="w-full border p-2 rounded"
                           placeholder="New Password">
                    <input id="confirm-password" type="password"
                           class="w-full border p-2 rounded"
                           placeholder="Confirm Password">
                </div>

                <button id="save-profile-btn"
                        class="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded w-full transition-colors">
                    Save Changes
                </button>
            </div>
        </div>`;
    }

    /* ═══════════════════ ROUTER ═══════════════════ */

    function showPage(page) {
        activePage = page;
        pageTitle.textContent = navItems.find(n => n.id === page)?.name || "Dashboard";

        let content = "";
        if (page === "dashboard") content = renderDashboard();
        if (page === "schedule")  content = renderSchedule();
        if (page === "logs")      content = renderLogs();
        if (page === "alerts")    content = renderAlerts();
        if (page === "profile")   content = renderProfile();

        pageContent.innerHTML = `
            <div class="bg-gray-50 min-h-full rounded-xl p-6">
                ${content}
            </div>`;
    }

    /* ═══════════════════ EVENT DELEGATION ═══════════════════ */

    document.body.addEventListener("click", async e => {

        /* ── ADD schedule row ── */
        if (e.target.closest(".add-time")) {
            const btn  = e.target.closest(".add-time");
            const slotNumber = parseInt(btn.dataset.slot);
            const slot = slots.find(s => s.slot_number === slotNumber);
            if (!slot.schedules) slot.schedules = [];
            slot.schedules.push({ time: "09:00", dosage: 1 });
            showPage("schedule");
            // scroll to the slot card so user sees the new row
            requestAnimationFrame(() => {
                const card = document.querySelector(`[data-slot="${slotNumber}"].save-slot`)
                    ?.closest(".bg-white");
                card?.scrollIntoView({ behavior: "smooth", block: "center" });
            });
            return;
        }

        /* ── REMOVE schedule row ── */
        if (e.target.closest(".remove-time")) {
            const btn  = e.target.closest(".remove-time");
            const slotNumber = parseInt(btn.dataset.slot);
            const index      = parseInt(btn.dataset.index);
            const slot = slots.find(s => s.slot_number === slotNumber);
            slot.schedules.splice(index, 1);
            showPage("schedule");
            return;
        }

        /* ── SAVE slot ── */
        if (e.target.closest(".save-slot")) {
            const btn        = e.target.closest(".save-slot");
            const slotNumber = parseInt(btn.dataset.slot);
            const slot       = slots.find(s => s.slot_number === slotNumber);

            /* read name & tablets from the card */
            slot.medicine_name =
                document.querySelector(`.slot-name[data-slot="${slotNumber}"]`).value.trim();

            const newTotal =
                parseInt(document.querySelector(`.slot-tablets[data-slot="${slotNumber}"]`).value) || 0;

            if (!slot.total_tablets || newTotal !== slot.total_tablets) {
                slot.total_tablets = newTotal;
                slot.tablets_left  = newTotal;     // reset remaining when total changes
            }

            /* read all schedule rows */
            const timeInputs   = document.querySelectorAll(`.schedule-time[data-slot="${slotNumber}"]`);
            const dosageInputs = document.querySelectorAll(`.schedule-dosage[data-slot="${slotNumber}"]`);

            slot.schedules = [];
            timeInputs.forEach((t, i) => {
                if (t.value) {
                    slot.schedules.push({
                        time:   t.value,
                        dosage: parseInt(dosageInputs[i].value) || 1
                    });
                }
            });

            slot.schedules.sort((a, b) => a.time.localeCompare(b.time));

            const res = await apiCall("/update_slot", "POST", slot);
            if (res?.success === true) {
                showToast(`Slot ${slotNumber} saved ✅`);
                showPage("schedule");   // re-render to reflect saved state
            } else {
                showToast(`Failed to save Slot ${slotNumber} ❌`, "error");
            }
            return;
        }

        /* ── NAV links ── */
        if (e.target.closest(".nav-link")) {
            e.preventDefault();
            showPage(e.target.closest(".nav-link").dataset.page);
            return;
        }

        /* ── LOGOUT ── */
        if (e.target.closest("#logout-btn")) { logout(); return; }

        /* ── PROFILE avatar click ── */
        if (e.target.closest("#profile-preview")) {
            document.getElementById("profile-upload")?.click();
            return;
        }

        /* ── SAVE profile ── */
        if (e.target.closest("#save-profile-btn")) {
            const name    = document.getElementById("prof-name").value.trim();
            const phone   = document.getElementById("prof-phone").value.trim();
            const pass    = document.getElementById("new-password").value;
            const confirm = document.getElementById("confirm-password").value;

            if (pass && pass !== confirm) {
                showToast("Passwords do not match ❌", "error");
                return;
            }

            let payload = { name, phone, profile_pic: userDetails.profile_pic };
            if (pass) payload.new_password = pass;

            const res = await apiCall("/update_profile", "POST", payload);
            if (res?.success === true) {
                userDetails = { ...userDetails, name, phone };
                showToast("Profile updated ✅");
            } else {
                showToast("Update failed ❌", "error");
            }
            return;
        }

        /* ── TEST alarm ── */
        if (e.target.closest("#test-alarm")) {
            new Audio(userDetails.custom_ringtone || DEFAULT_RINGTONE_URL).play();
            return;
        }
    });

    /* ── file change: profile photo / alarm ── */
    document.addEventListener("change", e => {
        if (e.target.id === "profile-upload") {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                userDetails.profile_pic = ev.target.result;
                document.getElementById("profile-preview").innerHTML =
                    `<img src="${ev.target.result}" class="h-full w-full object-cover">`;
            };
            reader.readAsDataURL(file);
        }

        if (e.target.id === "alarm-upload") {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                userDetails.custom_ringtone = ev.target.result;
                showToast("Custom ringtone loaded ✅");
            };
            reader.readAsDataURL(file);
        }
    });

    /* ═══════════════════ AUTO-DISPENSE ═══════════════════ */

    async function checkAndDispense() {
        const currentTime = new Date().toTimeString().slice(0, 5);

        for (const slot of slots) {
            for (const s of (slot.schedules || [])) {
                if (s.time === currentTime && slot.tablets_left >= s.dosage) {
                    slot.tablets_left -= s.dosage;

                    await apiCall("/log_dispense", "POST", {
                        slot_number:   slot.slot_number,
                        medicine_name: slot.medicine_name,
                        dosage:        s.dosage,
                        status:        "Taken"
                    });

                    await apiCall("/update_slot", "POST", slot);
                    showToast(`Dispensed ${s.dosage} tablet(s) of ${slot.medicine_name}`);

                    if (activePage === "dashboard") showPage("dashboard");
                }
            }
        }
    }

    /* ═══════════════════ INIT ═══════════════════ */

    async function init() {
        if (getToken()) {
            authPage.classList.add("page-hidden");
            appContainer.classList.remove("page-hidden");

            renderNav();

            const [profile, logs, inventory] = await Promise.all([
                apiCall("/get_profile"),
                apiCall("/get_logs"),
                apiCall("/get_inventory")
            ]);

            if (profile?.name) userDetails = profile;
            if (Array.isArray(logs)) dispenseLogs = logs;

            if (Array.isArray(inventory) && inventory.length > 0) {
                /* merge backend data into the 8 default slots */
                inventory.forEach(backendSlot => {
                    const idx = slots.findIndex(s => s.slot_number === backendSlot.slot_number);
                    if (idx !== -1) slots[idx] = backendSlot;
                });
            }

            showPage("dashboard");
        } else {
            appContainer.classList.add("page-hidden");
            authPage.classList.remove("page-hidden");
        }
    }

    setInterval(checkAndDispense, 60000);
    init();
});
