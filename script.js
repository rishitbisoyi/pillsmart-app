document.addEventListener('DOMContentLoaded', () => {

    const BACKEND_URL = '';
    const DEFAULT_RINGTONE_URL = "alarm.mp3";
    const LOW_STOCK_THRESHOLD = 5;

    function buildDefaultSlots() {
        return Array.from({ length: 8 }, (_, i) => ({
            slot_number: i + 1,
            medicine_name: "",
            total_tablets: 0,
            tablets_left: 0,
            schedules: []
        }));
    }

    let slots        = buildDefaultSlots();
    let dispenseLogs = [];
    let userDetails  = { name: "", email: "", phone: "", profile_pic: "", custom_ringtone: "" };
    let activePage   = "dashboard";

    const authPage     = document.getElementById("authPage");
    const appContainer = document.getElementById("appContainer");
    const pageContent  = document.getElementById("page-content");
    const pageTitle    = document.getElementById("page-title");
    const toast        = document.getElementById("toast");

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

    /* ═══════════════════ DASHBOARD HELPERS ═══════════════════ */

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
                if (!upcoming || doseTime < upcoming.time)
                    upcoming = { time: doseTime, medicine: slot.medicine_name, dosage: s.dosage };
            });
        });
        return upcoming;
    }

    function getTodaySchedule() {
        const items = [];
        slots.forEach(slot => {
            if (!slot.medicine_name) return;
            (slot.schedules || []).forEach(s => {
                if (!s.time) return;
                items.push({
                    time:     s.time,
                    medicine: slot.medicine_name,
                    dosage:   s.dosage,
                    slot:     slot.slot_number,
                    enough:   slot.tablets_left >= s.dosage
                });
            });
        });
        return items.sort((a, b) => a.time.localeCompare(b.time));
    }

    function getLowStockSlots() {
        return slots.filter(s => s.medicine_name && s.tablets_left <= LOW_STOCK_THRESHOLD);
    }

    function formatTime12(time24) {
        if (!time24) return "";
        const [h, m] = time24.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const hour = h % 12 || 12;
        return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
    }

    function getGreeting() {
        const h = new Date().getHours();
        if (h < 12) return "Good morning";
        if (h < 17) return "Good afternoon";
        return "Good evening";
    }

    /* ═══════════════════ DASHBOARD ═══════════════════ */

    function renderDashboard() {
        const totalSchedules = slots.reduce((a, s) => a + (s.schedules?.length || 0), 0);
        const next           = getNextDose();
        const todaySchedule  = getTodaySchedule();
        const lowStock       = getLowStockSlots();
        const recentLogs     = dispenseLogs.slice(0, 5);

        const now     = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
        const todayPrefix = now.toISOString().slice(0, 10);
        const todayCount  = dispenseLogs.filter(l => l.time && l.time.startsWith(todayPrefix)).length;

        return `
        <div class="space-y-6">

            <!-- Greeting Banner -->
            <div class="bg-gradient-to-r from-teal-600 to-teal-400 rounded-2xl p-6 text-white shadow-md">
                <div class="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <p class="text-teal-100 text-xs font-medium uppercase tracking-widest mb-1">${dateStr}</p>
                        <h2 class="text-2xl font-bold">${getGreeting()}, ${userDetails.name || "there"} 👋</h2>
                        <p class="text-teal-100 mt-1 text-sm">
                            ${next
                                ? `Next dose: <span class="text-white font-semibold">${next.medicine} (${next.dosage} tab)</span>
                                   at <span class="text-white font-semibold">${formatTime12(next.time.toTimeString().slice(0,5))}</span>`
                                : "No upcoming doses scheduled."}
                        </p>
                    </div>
                    <p class="text-4xl font-bold tracking-tight">${timeStr}</p>
                </div>
            </div>

            <!-- Stat Cards -->
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="bg-white p-5 rounded-xl shadow border border-gray-100">
                    <p class="text-gray-500 text-xs uppercase tracking-widest mb-1">Total Slots</p>
                    <p class="text-3xl font-bold text-teal-600">${slots.length}</p>
                </div>
                <div class="bg-white p-5 rounded-xl shadow border border-gray-100">
                    <p class="text-gray-500 text-xs uppercase tracking-widest mb-1">Total Schedules</p>
                    <p class="text-3xl font-bold text-teal-600">${totalSchedules}</p>
                </div>
                <div class="col-span-2 md:col-span-1 bg-white p-5 rounded-xl shadow border border-gray-100">
                    <p class="text-gray-500 text-xs uppercase tracking-widest mb-1">Dispensed Today</p>
                    <p class="text-3xl font-bold text-teal-600">${todayCount}</p>
                </div>
            </div>

            <div class="grid md:grid-cols-2 gap-6">

                <!-- Today's Schedule -->
                <div class="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 class="font-semibold text-gray-800">📅 Today's Schedule</h3>
                        <span class="text-xs text-gray-400">${todaySchedule.length} dose(s)</span>
                    </div>
                    <div class="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                        ${todaySchedule.length === 0
                            ? `<p class="text-gray-400 text-sm text-center py-8">No schedules set up yet.</p>`
                            : todaySchedule.map(d => `
                                <div class="flex items-center justify-between px-5 py-3">
                                    <div class="flex items-center gap-3">
                                        <span class="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-full whitespace-nowrap">
                                            ${formatTime12(d.time)}
                                        </span>
                                        <div>
                                            <p class="text-sm font-medium text-gray-800">${d.medicine}</p>
                                            <p class="text-xs text-gray-400">Slot ${d.slot} · ${d.dosage} tablet(s)</p>
                                        </div>
                                    </div>
                                    ${!d.enough
                                        ? `<span class="text-xs text-red-500 font-medium shrink-0">Low stock</span>`
                                        : `<span class="text-xs text-green-500 font-medium shrink-0">✓ Ready</span>`}
                                </div>`).join("")
                        }
                    </div>
                </div>

                <!-- Low Stock Warnings -->
                <div class="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 class="font-semibold text-gray-800">⚠️ Low Stock</h3>
                        <span class="text-xs text-gray-400">${lowStock.length} slot(s)</span>
                    </div>
                    <div class="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                        ${lowStock.length === 0
                            ? `<p class="text-gray-400 text-sm text-center py-8">All slots have sufficient stock. ✓</p>`
                            : lowStock.map(s => `
                                <div class="flex items-center justify-between px-5 py-3">
                                    <div class="flex items-center gap-3">
                                        <div class="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-red-500 font-bold text-sm shrink-0">
                                            ${s.slot_number}
                                        </div>
                                        <div>
                                            <p class="text-sm font-medium text-gray-800">${s.medicine_name}</p>
                                            <p class="text-xs text-gray-400">Slot ${s.slot_number}</p>
                                        </div>
                                    </div>
                                    <span class="text-xs font-bold px-2 py-1 rounded-full shrink-0
                                        ${s.tablets_left === 0 ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"}">
                                        ${s.tablets_left === 0 ? "Empty" : `${s.tablets_left} left`}
                                    </span>
                                </div>`).join("")
                        }
                    </div>
                </div>

            </div>

            <!-- Recent Logs -->
            <div class="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 class="font-semibold text-gray-800">🕓 Recent Dispenses</h3>
                    <a href="#" data-page="logs" class="nav-link text-xs text-teal-600 hover:underline font-medium">
                        View all →
                    </a>
                </div>
                <div class="divide-y divide-gray-50">
                    ${recentLogs.length === 0
                        ? `<p class="text-gray-400 text-sm text-center py-8">No dispenses recorded yet.</p>`
                        : recentLogs.map(l => `
                            <div class="flex items-center justify-between px-5 py-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-sm shrink-0">
                                        ${(l.medicine_name || "?")[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p class="text-sm font-medium text-gray-800">${l.medicine_name}</p>
                                        <p class="text-xs text-gray-400">${l.dosage} tablet(s) · Slot ${l.slot_number}</p>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <p class="text-xs text-gray-500">${l.time || ""}</p>
                                    <p class="text-xs text-green-600 font-medium">${l.status || "Taken"}</p>
                                </div>
                            </div>`).join("")
                    }
                </div>
            </div>

        </div>`;
    }

    /* ═══════════════════ SCHEDULE ═══════════════════ */

    function renderSchedule() {
        return `
        <div class="space-y-6">
            <div class="grid md:grid-cols-2 gap-6">
                ${slots.map(slot => renderSlotCard(slot)).join("")}
            </div>
        </div>`;
    }

    function renderSlotCard(slot) {
        const lowStock = slot.tablets_left > 0 && slot.tablets_left <= LOW_STOCK_THRESHOLD;
        const scheduleRows = (slot.schedules || []).map((sch, i) => `
            <div class="flex items-center gap-2 schedule-row">
                <input type="time"
                       data-slot="${slot.slot_number}" data-index="${i}"
                       class="schedule-time border p-2 rounded flex-1 text-sm"
                       value="${sch.time || "09:00"}">
                <input type="number"
                       data-slot="${slot.slot_number}" data-index="${i}"
                       class="schedule-dosage border p-2 rounded w-20 text-sm"
                       placeholder="Dose" min="1" value="${sch.dosage || 1}">
                <span class="text-xs text-gray-400">tab</span>
                <button data-slot="${slot.slot_number}" data-index="${i}"
                        class="remove-time text-red-500 hover:text-red-700 font-bold text-lg leading-none"
                        title="Remove this schedule">✕</button>
            </div>`).join("");

        return `
        <div class="bg-white p-6 rounded-xl shadow space-y-4
             ${lowStock ? "border-2 border-red-400" : "border border-gray-200"}">
            <div class="flex items-center justify-between">
                <h3 class="font-bold text-lg text-teal-700">Slot ${slot.slot_number}</h3>
                ${lowStock
                    ? `<span class="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">⚠ Low Stock (${slot.tablets_left} left)</span>`
                    : slot.tablets_left > 0
                        ? `<span class="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">${slot.tablets_left} remaining</span>`
                        : `<span class="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Empty</span>`}
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-600 mb-1">Medicine Name</label>
                <input data-slot="${slot.slot_number}"
                       class="slot-name border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-teal-400"
                       placeholder="e.g. Paracetamol 500mg" value="${slot.medicine_name || ""}">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-600 mb-1">Total Tablets</label>
                <input data-slot="${slot.slot_number}" type="number" min="0"
                       class="slot-tablets border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-teal-400"
                       placeholder="e.g. 30" value="${slot.total_tablets || ""}">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-600 mb-2">
                    Schedules <span class="ml-1 text-xs text-gray-400">(Time + Dosage per schedule)</span>
                </label>
                <div class="space-y-2" id="schedules-slot-${slot.slot_number}">
                    ${scheduleRows || `<p class="text-sm text-gray-400 italic">No schedules added yet.</p>`}
                </div>
                <button data-slot="${slot.slot_number}"
                        class="add-time mt-3 flex items-center gap-1 text-teal-600 hover:text-teal-800 text-sm font-medium">
                    <span class="text-lg font-bold leading-none">+</span> Add Schedule
                </button>
            </div>
            <button data-slot="${slot.slot_number}"
                    class="save-slot w-full bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded font-medium transition-colors">
                Save Slot ${slot.slot_number}
            </button>
        </div>`;
    }

    /* ═══════════════════ LOGS ═══════════════════ */

    function renderLogs() {
        return `
        <div class="space-y-4">
            <div class="flex justify-end">
                ${dispenseLogs.length > 0 ? `
                    <button id="clear-all-logs"
                            class="flex items-center gap-2 text-sm font-semibold text-red-500
                                   bg-red-50 border border-red-200 px-4 py-2 rounded-lg
                                   hover:bg-red-100 transition-colors">
                        🗑 Clear All
                    </button>` : ""}
            </div>
            <div class="bg-white rounded-xl shadow overflow-hidden">
                ${dispenseLogs.length === 0
                    ? `<div class="p-10 text-center text-gray-400">
                           <p class="text-4xl mb-3">📋</p>
                           <p class="font-medium text-gray-500">No dispense logs yet.</p>
                           <p class="text-sm mt-1">Logs will appear here once medicines are dispensed.</p>
                       </div>`
                    : `<div class="divide-y divide-gray-100">
                        ${dispenseLogs.map(l => `
                            <div class="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 rounded-full bg-teal-50 flex items-center
                                                justify-center text-teal-600 font-bold text-sm shrink-0">
                                        ${(l.medicine_name || "?")[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p class="font-semibold text-gray-800">${l.medicine_name}</p>
                                        <p class="text-sm text-gray-500">${l.dosage} tablet(s) · Slot ${l.slot_number}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3">
                                    <div class="text-right hidden sm:block">
                                        <p class="text-sm text-gray-600">${l.time || ""}</p>
                                        <p class="text-xs text-green-600 font-medium">${l.status || "Taken"}</p>
                                    </div>
                                    <button data-log-id="${l._id}"
                                            class="delete-log w-8 h-8 flex items-center justify-center
                                                   rounded-lg text-gray-300 hover:text-red-500
                                                   hover:bg-red-50 transition-colors text-sm font-bold"
                                            title="Delete this log">✕</button>
                                </div>
                            </div>`).join("")}
                       </div>`
                }
            </div>
        </div>`;
    }

    /* ═══════════════════ ALERTS ═══════════════════ */

    function renderAlerts() {
        return `
        <div class="space-y-6">
            <div class="bg-white p-6 rounded-xl shadow space-y-4">
                <label class="block text-sm font-medium text-gray-600">Upload Custom Ringtone</label>
                <input type="file" id="alarm-upload" accept="audio/*" class="border p-2 w-full rounded">
                <button id="test-alarm" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors">
                    ▶ Test Alarm
                </button>
            </div>
        </div>`;
    }

    /* ═══════════════════ PROFILE ═══════════════════ */

    function renderProfile() {
        const initials = (userDetails.name || "U").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
        return `
        <div class="flex justify-center">
            <div class="bg-white p-10 rounded-2xl shadow-lg w-full max-w-xl space-y-6">
                <div class="flex flex-col items-center space-y-3">
                    <div id="profile-preview"
                         class="h-28 w-28 rounded-full bg-teal-500 text-white
                                flex items-center justify-center text-3xl font-bold
                                overflow-hidden cursor-pointer shadow-md">
                        ${userDetails.profile_pic
                            ? `<img src="${userDetails.profile_pic}" class="h-full w-full object-cover">`
                            : initials}
                    </div>
                    <input type="file" id="profile-upload" accept="image/*" class="hidden">
                    <p class="text-xs text-gray-400">Click avatar to change photo</p>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Name</label>
                    <input id="prof-name" class="w-full border p-2 rounded" value="${userDetails.name || ""}">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Email</label>
                    <input class="w-full border p-2 rounded bg-gray-100" value="${userDetails.email || ""}" disabled>
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">Phone</label>
                    <input id="prof-phone" class="w-full border p-2 rounded" value="${userDetails.phone || ""}">
                </div>
                <div class="space-y-2">
                    <label class="block text-sm font-medium">Change Password</label>
                    <input id="new-password" type="password" class="w-full border p-2 rounded" placeholder="New Password">
                    <input id="confirm-password" type="password" class="w-full border p-2 rounded" placeholder="Confirm Password">
                </div>
                <button id="save-profile-btn"
                        class="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded w-full transition-colors">
                    Save Changes
                </button>
            </div>
        </div>`;
    }

    /* ═══════════════════ ABOUT US ═══════════════════ */

    function renderAbout() {
        return `
        <div class="max-w-3xl mx-auto space-y-8">
            <div class="bg-gradient-to-r from-teal-600 to-teal-400 rounded-2xl p-8 text-white shadow-md">
                <h2 class="text-3xl font-bold mb-2">About PillSmart</h2>
                <p class="text-teal-100 text-base leading-relaxed">
                    We're on a mission to make medication management simple, reliable, and stress-free
                    for patients and caregivers everywhere.
                </p>
            </div>
            <div class="grid md:grid-cols-3 gap-5">
                <div class="bg-white rounded-xl p-6 shadow border border-gray-100 text-center">
                    <div class="text-4xl mb-3">💊</div>
                    <h4 class="font-semibold text-gray-800 mb-1">Smart Dispensing</h4>
                    <p class="text-sm text-gray-500">Automated, time-precise medicine dispensing so you never miss a dose.</p>
                </div>
                <div class="bg-white rounded-xl p-6 shadow border border-gray-100 text-center">
                    <div class="text-4xl mb-3">🔔</div>
                    <h4 class="font-semibold text-gray-800 mb-1">Real-time Alerts</h4>
                    <p class="text-sm text-gray-500">Low stock warnings and custom alarms keep you always informed.</p>
                </div>
                <div class="bg-white rounded-xl p-6 shadow border border-gray-100 text-center">
                    <div class="text-4xl mb-3">📊</div>
                    <h4 class="font-semibold text-gray-800 mb-1">Full Tracking</h4>
                    <p class="text-sm text-gray-500">Detailed logs of every dispense so you always have a clear history.</p>
                </div>
            </div>
            <div class="bg-white rounded-xl p-8 shadow border border-gray-100 space-y-4">
                <h3 class="text-xl font-bold text-gray-800">Our Story</h3>
                <p class="text-gray-600 leading-relaxed">
                    PillSmart was born from a simple observation: managing multiple medications on a
                    daily schedule is hard — especially for elderly patients or busy caregivers.
                    Missed doses, wrong dosages, and empty slots happen far too often.
                </p>
                <p class="text-gray-600 leading-relaxed">
                    We built a smart dispenser paired with a clean, intuitive dashboard so that
                    managing up to 8 different medications becomes as easy as setting an alarm.
                    Every slot, every schedule, every dispense — tracked and under your control.
                </p>
            </div>
            <div class="bg-white rounded-xl p-8 shadow border border-gray-100">
                <h3 class="text-xl font-bold text-gray-800 mb-5">Core Values</h3>
                <div class="space-y-4">
                    ${[
                        ["🎯", "Precision",   "Every dose at exactly the right time, every time."],
                        ["🤝", "Reliability", "Hardware and software built to work together seamlessly."],
                        ["🔒", "Privacy",     "Your health data stays yours — always secured and private."],
                        ["💡", "Simplicity",  "Powerful features wrapped in an interface anyone can use."]
                    ].map(([icon, title, desc]) => `
                        <div class="flex items-start gap-4">
                            <span class="text-2xl mt-0.5">${icon}</span>
                            <div>
                                <p class="font-semibold text-gray-800">${title}</p>
                                <p class="text-sm text-gray-500">${desc}</p>
                            </div>
                        </div>`).join("")}
                </div>
            </div>
        </div>`;
    }

    /* ═══════════════════ OUR PRODUCT ═══════════════════ */

    function renderProduct() {
        return `
        <div class="max-w-3xl mx-auto space-y-8">
            <div class="bg-gradient-to-r from-teal-600 to-teal-400 rounded-2xl p-8 text-white shadow-md">
                <h2 class="text-3xl font-bold mb-2">Our Product</h2>
                <p class="text-teal-100 text-base leading-relaxed">
                    The PillSmart Dispenser — 8 independent slots, cloud-connected, and controlled
                    entirely from this dashboard.
                </p>
            </div>
            <div class="grid md:grid-cols-2 gap-5">
                ${[
                    ["💊", "8 Independent Slots",  "Each slot holds a different medicine with its own schedule and dosage settings."],
                    ["⏰", "Flexible Scheduling",  "Set as many daily times as needed per slot. Add or remove schedules instantly."],
                    ["📉", "Stock Monitoring",      "Live tracking of remaining tablets with low-stock alerts before you run out."],
                    ["🔊", "Custom Alarm",          "Upload your own ringtone to play when it's time to take your medicine."],
                    ["📋", "Dispense Logs",         "Every dispense is recorded with time, medicine name, dosage and slot number."],
                    ["☁️", "Cloud Sync",            "All settings are stored in the cloud — access and manage from any device."]
                ].map(([icon, title, desc]) => `
                    <div class="bg-white rounded-xl p-6 shadow border border-gray-100 flex gap-4">
                        <span class="text-3xl mt-0.5 shrink-0">${icon}</span>
                        <div>
                            <h4 class="font-semibold text-gray-800 mb-1">${title}</h4>
                            <p class="text-sm text-gray-500 leading-relaxed">${desc}</p>
                        </div>
                    </div>`).join("")}
            </div>
            <div class="bg-white rounded-xl p-8 shadow border border-gray-100">
                <h3 class="text-xl font-bold text-gray-800 mb-5">How It Works</h3>
                <div class="space-y-5">
                    ${[
                        ["1", "from-teal-600 to-teal-500", "Fill the slots",          "Load each slot with the correct medicine and set the total tablet count."],
                        ["2", "from-teal-500 to-teal-400", "Set your schedules",      "Add one or more daily times per slot along with the dosage amount."],
                        ["3", "from-teal-400 to-teal-300", "Let PillSmart handle it", "The dispenser automatically releases the right dose at the right time."],
                        ["4", "from-teal-300 to-teal-200", "Track everything",        "Check your logs and stock levels any time from the dashboard."]
                    ].map(([num, grad, title, desc]) => `
                        <div class="flex items-start gap-4">
                            <div class="w-8 h-8 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center font-bold text-sm shrink-0">
                                ${num}
                            </div>
                            <div>
                                <p class="font-semibold text-gray-800">${title}</p>
                                <p class="text-sm text-gray-500">${desc}</p>
                            </div>
                        </div>`).join("")}
                </div>
            </div>
            <div class="bg-teal-50 border border-teal-200 rounded-xl p-6 text-center">
                <p class="text-teal-800 font-semibold text-lg mb-1">Ready to get started?</p>
                <p class="text-teal-600 text-sm mb-4">Head to Schedule Inventory to set up your slots and schedules.</p>
                <button data-page="schedule"
                        class="nav-link inline-block bg-teal-600 hover:bg-teal-700 text-white
                               font-semibold px-6 py-2 rounded-lg transition-colors">
                    Set Up Schedules →
                </button>
            </div>
        </div>`;
    }

    /* ═══════════════════ ROUTER ═══════════════════ */

    function showPage(page) {
        activePage = page;
        const headerPages = { "about": "About Us", "product": "Our Product" };
        pageTitle.textContent =
            navItems.find(n => n.id === page)?.name ||
            headerPages[page] || "Dashboard";

        let content = "";
        if (page === "dashboard") content = renderDashboard();
        if (page === "schedule")  content = renderSchedule();
        if (page === "logs")      content = renderLogs();
        if (page === "alerts")    content = renderAlerts();
        if (page === "profile")   content = renderProfile();
        if (page === "about")     content = renderAbout();
        if (page === "product")   content = renderProduct();

        pageContent.innerHTML = `
            <div class="bg-gray-50 min-h-full rounded-xl p-6">
                ${content}
            </div>`;
    }

    /* ═══════════════════ REFRESH LOGS ═══════════════════ */

    async function refreshLogs() {
        const logs = await apiCall("/get_logs");
        if (Array.isArray(logs)) {
            dispenseLogs = logs;
            if (activePage === "logs") showPage("logs");
        }
    }

    /* ═══════════════════ EVENT DELEGATION ═══════════════════ */

    document.body.addEventListener("click", async e => {

        /* ── ADD schedule row ── */
        if (e.target.closest(".add-time")) {
            const btn = e.target.closest(".add-time");
            const slotNumber = parseInt(btn.dataset.slot);
            const slot = slots.find(s => s.slot_number === slotNumber);
            if (!slot.schedules) slot.schedules = [];
            slot.schedules.push({ time: "09:00", dosage: 1 });
            showPage("schedule");
            requestAnimationFrame(() => {
                document.querySelector(`.save-slot[data-slot="${slotNumber}"]`)
                    ?.closest(".bg-white")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
            });
            return;
        }

        /* ── REMOVE schedule row ── */
        if (e.target.closest(".remove-time")) {
            const btn = e.target.closest(".remove-time");
            const slot = slots.find(s => s.slot_number === parseInt(btn.dataset.slot));
            slot.schedules.splice(parseInt(btn.dataset.index), 1);
            showPage("schedule");
            return;
        }

        /* ── SAVE slot ── */
        if (e.target.closest(".save-slot")) {
            const btn        = e.target.closest(".save-slot");
            const slotNumber = parseInt(btn.dataset.slot);
            const slot       = slots.find(s => s.slot_number === slotNumber);

            slot.medicine_name =
                document.querySelector(`.slot-name[data-slot="${slotNumber}"]`).value.trim();
            const newTotal =
                parseInt(document.querySelector(`.slot-tablets[data-slot="${slotNumber}"]`).value) || 0;

            if (!slot.total_tablets || newTotal !== slot.total_tablets) {
                slot.total_tablets = newTotal;
                slot.tablets_left  = newTotal;
            }

            const timeInputs   = document.querySelectorAll(`.schedule-time[data-slot="${slotNumber}"]`);
            const dosageInputs = document.querySelectorAll(`.schedule-dosage[data-slot="${slotNumber}"]`);
            slot.schedules = [];
            timeInputs.forEach((t, i) => {
                if (t.value) slot.schedules.push({ time: t.value, dosage: parseInt(dosageInputs[i].value) || 1 });
            });
            slot.schedules.sort((a, b) => a.time.localeCompare(b.time));

            const res = await apiCall("/update_slot", "POST", slot);
            if (res?.success === true) {
                showToast(`Slot ${slotNumber} saved ✅`);
                showPage("schedule");
            } else {
                showToast(`Failed to save Slot ${slotNumber} ❌`, "error");
            }
            return;
        }

        /* ── DELETE single log ── */
        if (e.target.closest(".delete-log")) {
            const btn   = e.target.closest(".delete-log");
            const logId = btn.dataset.logId;
            const res   = await apiCall("/delete_log", "POST", { log_id: logId });
            if (res?.success === true) {
                dispenseLogs = dispenseLogs.filter(l => l._id !== logId);
                showPage("logs");
                showToast("Log deleted ✅");
            } else {
                showToast("Failed to delete log ❌", "error");
            }
            return;
        }

        /* ── CLEAR ALL logs ── */
        if (e.target.closest("#clear-all-logs")) {
            if (!confirm("Delete all dispense logs? This cannot be undone.")) return;
            const res = await apiCall("/delete_all_logs", "POST");
            if (res?.success === true) {
                dispenseLogs = [];
                showPage("logs");
                showToast("All logs cleared ✅");
            } else {
                showToast("Failed to clear logs ❌", "error");
            }
            return;
        }

        /* ── NAV links (sidebar, bottom nav, inline page links) ── */
        if (e.target.closest(".nav-link")) {
            e.preventDefault();
            showPage(e.target.closest(".nav-link").dataset.page);
            return;
        }

        /* ── HEADER nav buttons (About / Product) ── */
        if (e.target.closest(".header-nav-btn")) {
            showPage(e.target.closest(".header-nav-btn").dataset.page);
            return;
        }

        /* ── LOGOUT ── */
        if (e.target.closest("#logout-btn")) { logout(); return; }

        /* ── PROFILE avatar ── */
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
            if (pass && pass !== confirm) { showToast("Passwords do not match ❌", "error"); return; }
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

    /* ── File inputs ── */
    document.addEventListener("change", e => {
        if (e.target.id === "profile-upload") {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                userDetails.profile_pic = ev.target.result;
                document.getElementById("profile-preview").innerHTML =
                    `<img src="${ev.target.result}" class="h-full w-full object-cover">`;
            };
            reader.readAsDataURL(file);
        }
        if (e.target.id === "alarm-upload") {
            const file = e.target.files[0]; if (!file) return;
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
        let didDispense = false;

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
                    didDispense = true;
                }
            }
        }

        if (didDispense) {
            await refreshLogs();
            if (activePage === "dashboard") showPage("dashboard");
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
