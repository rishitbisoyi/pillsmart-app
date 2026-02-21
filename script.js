document.addEventListener('DOMContentLoaded', () => {

    const BACKEND_URL = '';
    const DEFAULT_RINGTONE_URL = "alarm.mp3";

    let slots = [];
    let logs = [];
    let userDetails = { name:"", email:"", phone:"", profile_pic:"", custom_ringtone:"" };
    let activePage = "dashboard";

    const authPage = document.getElementById("authPage");
    const appContainer = document.getElementById("appContainer");

    const getToken = () =>
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken");

    async function api(endpoint, method="GET", body=null){
        const token = getToken();
        const headers = {
            "Content-Type":"application/json",
            ...(token ? { "Authorization":`Bearer ${token}` } : {})
        };

        const res = await fetch(`${BACKEND_URL}${endpoint}`,{
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        return await res.json();
    }

    function showToast(msg,type="success"){
        const t=document.getElementById("toast");
        t.textContent=msg;
        t.className=`bg-${type==="success"?"teal":"red"}-500 show`;
        setTimeout(()=>t.classList.remove("show"),3000);
    }

    /* ================= AUTH ================= */

    async function login(email,password){
        const remember=document.getElementById("rememberMe").checked;
        const res=await api("/login","POST",{email,password});
        if(res.success){
            const store=remember?localStorage:sessionStorage;
            store.setItem("authToken",res.token);
            store.setItem("userName",res.name);
            store.setItem("userEmail",res.email);
            window.location.reload();
        } else showToast(res.error,"error");
    }

    function logout(){
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    }

    /* ================= DASHBOARD ================= */

    function renderDashboard(){
        const active = slots.filter(s=>s.medicine_name).length;
        const totalTablets = slots.reduce((sum,s)=>sum+s.tablets_left,0);

        return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="dashboard-card">
                <h3 class="text-lg font-semibold">Active Slots</h3>
                <p class="text-3xl font-bold text-teal-600">${active}/8</p>
            </div>
            <div class="dashboard-card">
                <h3 class="text-lg font-semibold">Total Tablets Left</h3>
                <p class="text-3xl font-bold text-blue-600">${totalTablets}</p>
            </div>
        </div>`;
    }

    /* ================= DISPENSER MANAGER ================= */

    function renderSlots(){
        return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${slots.map(s=>`
            <div class="dashboard-card p-5">
                <h3 class="font-bold text-lg mb-2">Slot ${s.slot_number}</h3>
                <p><b>Medicine:</b> ${s.medicine_name || "Empty"}</p>
                <p><b>Tablets:</b> ${s.tablets_left}/${s.total_tablets}</p>
                <div class="mt-3">
                    <b>Schedules:</b>
                    ${s.schedules.length ?
                        s.schedules.map(sc=>`
                            <div class="text-sm text-gray-600">
                                ${sc.time} → ${sc.dosage} tab
                            </div>`).join('')
                        : `<div class="text-gray-400 text-sm">No schedules</div>`}
                </div>
                <div class="mt-4 flex gap-2">
                    <button class="edit-slot bg-blue-500 text-white px-3 py-1 rounded"
                        data-slot="${s.slot_number}">Edit</button>
                    <button class="clear-slot bg-red-500 text-white px-3 py-1 rounded"
                        data-slot="${s.slot_number}">Clear</button>
                </div>
            </div>
        `).join('')}
        </div>`;
    }

    /* ================= LOGS ================= */

    function renderLogs(){
        return `
        <div class="dashboard-card">
            <h2 class="text-xl font-bold mb-4">Dispense Logs</h2>
            <table class="w-full text-left">
                <thead>
                    <tr class="border-b bg-gray-50">
                        <th class="p-2">Time</th>
                        <th class="p-2">Slot</th>
                        <th class="p-2">Medicine</th>
                        <th class="p-2">Dosage</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(l=>`
                        <tr class="border-b">
                            <td class="p-2">${l.time}</td>
                            <td class="p-2">${l.slot_number}</td>
                            <td class="p-2">${l.medicine_name}</td>
                            <td class="p-2">${l.dosage}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
    }

    /* ================= NAV ================= */

    function showPage(id){
        activePage=id;
        let content="";
        if(id==="dashboard") content=renderDashboard();
        if(id==="schedule") content=renderSlots();
        if(id==="logs") content=renderLogs();
        document.getElementById("page-content").innerHTML=content;
    }

    /* ================= DATA LOAD ================= */

    async function refresh(){
        if(!getToken()) return;
        const [s,l,p]=await Promise.all([
            api("/get_slots"),
            api("/get_logs"),
            api("/get_profile")
        ]);
        slots=Array.isArray(s)?s:[];
        logs=Array.isArray(l)?l:[];
        if(p.email) userDetails=p;
        showPage(activePage);
    }

    async function showApp(){
        authPage.classList.add("page-hidden");
        appContainer.classList.remove("page-hidden");
        await refresh();
    }

    function showAuth(){
        appContainer.classList.add("page-hidden");
        authPage.classList.remove("page-hidden");
    }

    /* ================= EVENTS ================= */

    document.body.addEventListener("click",async e=>{

        if(e.target.closest("#logout-btn")) logout();

        const edit=e.target.closest(".edit-slot");
        if(edit){
            const num=parseInt(edit.dataset.slot);
            const name=prompt("Medicine name:");
            const total=parseInt(prompt("Total tablets:"));
            const left=parseInt(prompt("Tablets left:"));
            const schedules=[];
            while(confirm("Add schedule?")){
                const time=prompt("Time (HH:MM)");
                const dosage=parseInt(prompt("Dosage"));
                schedules.push({time,dosage});
            }
            await api("/update_slot","POST",{
                slot_number:num,
                medicine_name:name,
                total_tablets:total,
                tablets_left:left,
                schedules:schedules
            });
            refresh();
        }

        const clear=e.target.closest(".clear-slot");
        if(clear){
            const num=parseInt(clear.dataset.slot);
            if(confirm("Clear slot?")){
                await api("/clear_slot","POST",{slot_number:num});
                refresh();
            }
        }
    });

    document.getElementById("login-form")
        .addEventListener("submit",e=>{
            e.preventDefault();
            login(
                document.getElementById("login-email").value,
                document.getElementById("login-password").value
            );
        });

    document.getElementById("signup-form")
        .addEventListener("submit",async e=>{
            e.preventDefault();
            const res=await api("/register","POST",{
                name:document.getElementById("signup-name").value,
                email:document.getElementById("signup-email").value,
                password:document.getElementById("signup-password").value
            });
            if(res.success){
                showToast("Registered!");
            } else showToast(res.error,"error");
        });

    if(getToken()) showApp();
    else showAuth();
});
