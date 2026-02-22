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
    {id:"schedule",name:"Schedule Inventory"},
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

    function renderSchedule() {

    return `
    <div class="space-y-6">

        <h2 class="text-2xl font-bold">Schedule Inventory</h2>

        <div class="grid md:grid-cols-2 gap-6">

            ${slots.map(slot=>`

                <div class="bg-white p-6 rounded-xl shadow space-y-4
                    ${slot.tablets_left <= LOW_STOCK_THRESHOLD ? "border-2 border-red-500" : ""}">

                    <h3 class="font-bold text-lg">
                        Slot ${slot.slot_number}
                        <span class="text-sm text-gray-500">
                            (${slot.tablets_left || 0} left)
                        </span>
                    </h3>

                    <input data-slot="${slot.slot_number}"
                           class="slot-name border p-2 w-full rounded"
                           placeholder="Medicine Name"
                           value="${slot.medicine_name || ""}">

                    <input data-slot="${slot.slot_number}"
                           type="number"
                           class="slot-tablets border p-2 w-full rounded"
                           placeholder="Total Tablets"
                           value="${slot.total_tablets || 0}">

                    <div class="space-y-2">

                        ${(slot.schedules||[])
                            .sort((a,b)=>a.time.localeCompare(b.time))
                            .map((sch,i)=>`
                            <div class="flex gap-2">
                                <input type="time"
                                       data-slot="${slot.slot_number}"
                                       data-index="${i}"
                                       class="schedule-time border p-2 rounded w-1/2"
                                       value="${sch.time}">

                                <input type="number"
                                       data-slot="${slot.slot_number}"
                                       data-index="${i}"
                                       class="schedule-dosage border p-2 rounded w-1/3"
                                       value="${sch.dosage}">

                                <button data-slot="${slot.slot_number}"
                                        data-index="${i}"
                                        class="remove-time text-red-600">
                                        ✕
                                </button>
                            </div>
                        `).join("")}

                        <button data-slot="${slot.slot_number}"
                                class="add-time text-teal-600 text-sm">
                            + Add Time
                        </button>
                    </div>

                    <button data-slot="${slot.slot_number}"
                            class="save-slot bg-teal-600 text-white px-4 py-2 rounded w-full">
                        Save Slot
                    </button>

                </div>
            `).join("")}

        </div>

    </div>`;
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
        if(page==="schedule") pageContent.innerHTML = renderSchedule();
    }

    /* ================= EVENTS ================= */

    document.body.addEventListener("click", async e => {

                /* ======== SCHEDULE INVENTORY LOGIC (ADDED) ======== */

        if(e.target.closest(".add-time")) {
            const slot = slots.find(s => s.slot_number == e.target.dataset.slot);
            if(!slot.schedules) slot.schedules = [];
            slot.schedules.push({ time: "09:00", dosage: 1 });
            showPage("schedule");
        }

        if(e.target.closest(".remove-time")) {
            const slot = slots.find(s => s.slot_number == e.target.dataset.slot);
            slot.schedules.splice(e.target.dataset.index, 1);
            showPage("schedule");
        }

        if(e.target.closest(".save-slot")) {

            const slotNumber = e.target.dataset.slot;
            const slot = slots.find(s => s.slot_number == slotNumber);

            slot.medicine_name =
                document.querySelector(`.slot-name[data-slot="${slotNumber}"]`).value;

            slot.total_tablets =
                parseInt(document.querySelector(`.slot-tablets[data-slot="${slotNumber}"]`).value);

            if(!slot.tablets_left || slot.tablets_left > slot.total_tablets) {
                slot.tablets_left = slot.total_tablets;
            }

            const timeInputs =
                document.querySelectorAll(`.schedule-time[data-slot="${slotNumber}"]`);

            const dosageInputs =
                document.querySelectorAll(`.schedule-dosage[data-slot="${slotNumber}"]`);

            slot.schedules = [];

            timeInputs.forEach((t,i)=>{
                if(t.value) {
                    slot.schedules.push({
                        time: t.value,
                        dosage: parseInt(dosageInputs[i].value) || 1
                    });
                }
            });

            slot.schedules.sort((a,b)=>a.time.localeCompare(b.time));

            const res = await apiCall("/update_slot","POST",slot);

            if(res && res.success === true) {
                showToast("Slot Saved Successfully ✅");
            } else {
                showToast("Failed to Save Slot ❌","error");
            }
        }

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
    async function checkAndDispense() {

        const now = new Date();
        const currentTime = now.toTimeString().slice(0,5);

        for(const slot of slots) {

            for(const s of (slot.schedules || [])) {

                if(s.time === currentTime && slot.tablets_left >= s.dosage) {

                    slot.tablets_left -= s.dosage;

                    await apiCall("/log_dispense","POST",{
                        slot_number: slot.slot_number,
                        medicine_name: slot.medicine_name,
                        dosage: s.dosage,
                        status:"Taken"
                    });

                    await apiCall("/update_slot","POST",slot);

                    showToast(`Dispensed ${s.dosage} from ${slot.medicine_name}`);
                }
            }
        }
    }

    setInterval(checkAndDispense, 60000);
    init();
});
