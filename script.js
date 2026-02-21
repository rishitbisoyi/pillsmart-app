document.addEventListener('DOMContentLoaded', () => {

    const BACKEND_URL = '';

    let slots = [];
    let logs = [];
    let activePage = "dashboard";

    const authPage = document.getElementById("authPage");
    const appContainer = document.getElementById("appContainer");

    const loginFormContainer = document.getElementById("login-form-container");
    const signupFormContainer = document.getElementById("signup-form-container");
    const forgotPasswordContainer = document.getElementById("forgot-password-container");

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
        t.className=`fixed top-4 right-4 text-white px-4 py-2 rounded shadow-lg z-50 bg-${type==="success"?"teal":"red"}-500`;
        t.classList.remove("hidden");
        setTimeout(()=>t.classList.add("hidden"),3000);
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

    /* ================= NAVIGATION ================= */

    const navItems = [
        {id:"dashboard",name:"Dashboard"},
        {id:"schedule",name:"Dispenser Manager"},
        {id:"logs",name:"Logs"}
    ];

    function renderNav(){
        const sidebar=document.getElementById("sidebar-nav");
        const bottom=document.getElementById("bottom-nav");

        sidebar.innerHTML="";
        bottom.innerHTML="";

        navItems.forEach(item=>{
            sidebar.innerHTML+=`
                <a href="#" class="block px-6 py-3 hover:bg-gray-100 ${activePage===item.id?"font-bold text-teal-600":""}"
                   data-page="${item.id}">
                   ${item.name}
                </a>`;
            bottom.innerHTML+=`
                <a href="#" class="flex-1 text-center py-2 ${activePage===item.id?"text-teal-600":"text-gray-500"}"
                   data-page="${item.id}">
                   ${item.name}
                </a>`;
        });
    }

    function showPage(id){
        activePage=id;
        document.getElementById("page-title").textContent =
            navItems.find(n=>n.id===id)?.name || "Dashboard";

        let content="";
        if(id==="dashboard"){
            const active = slots.filter(s=>s.medicine_name).length;
            const total = slots.reduce((sum,s)=>sum+s.tablets_left,0);
            content=`
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="dashboard-card">
                        <h3 class="text-lg font-semibold">Active Slots</h3>
                        <p class="text-3xl font-bold text-teal-600">${active}/8</p>
                    </div>
                    <div class="dashboard-card">
                        <h3 class="text-lg font-semibold">Total Tablets Left</h3>
                        <p class="text-3xl font-bold text-blue-600">${total}</p>
                    </div>
                </div>`;
        }

        if(id==="schedule"){
            content=`
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${slots.map(s=>`
                <div class="dashboard-card p-5">
                    <h3 class="font-bold text-lg mb-2">Slot ${s.slot_number}</h3>
                    <p><b>Medicine:</b> ${s.medicine_name || "Empty"}</p>
                    <p><b>Tablets:</b> ${s.tablets_left}/${s.total_tablets}</p>
                    <div class="mt-3">
                        ${s.schedules.map(sc=>`
                            <div class="text-sm">${sc.time} → ${sc.dosage}</div>
                        `).join('')}
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

        if(id==="logs"){
            content=`
            <div class="dashboard-card">
                <table class="w-full text-left">
                    <thead>
                        <tr><th>Time</th><th>Slot</th><th>Medicine</th><th>Dosage</th></tr>
                    </thead>
                    <tbody>
                        ${logs.map(l=>`
                            <tr>
                                <td>${l.time}</td>
                                <td>${l.slot_number}</td>
                                <td>${l.medicine_name}</td>
                                <td>${l.dosage}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
        }

        document.getElementById("page-content").innerHTML=content;
        renderNav();
    }

    /* ================= DATA ================= */

    async function refresh(){
        if(!getToken()) return;
        const [s,l]=await Promise.all([
            api("/get_slots"),
            api("/get_logs")
        ]);
        slots=Array.isArray(s)?s:[];
        logs=Array.isArray(l)?l:[];
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

        if(e.target.closest("[data-page]")){
            e.preventDefault();
            showPage(e.target.closest("[data-page]").dataset.page);
        }

        if(e.target.closest("#show-signup-link")){
            e.preventDefault();
            loginFormContainer.classList.add("page-hidden");
            signupFormContainer.classList.remove("page-hidden");
        }

        if(e.target.closest("#show-login-link") || e.target.closest("#back-to-login-link")){
            e.preventDefault();
            signupFormContainer.classList.add("page-hidden");
            forgotPasswordContainer.classList.add("page-hidden");
            loginFormContainer.classList.remove("page-hidden");
        }

        if(e.target.closest("#forgot-password-link")){
            e.preventDefault();
            loginFormContainer.classList.add("page-hidden");
            forgotPasswordContainer.classList.remove("page-hidden");
        }

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
                signupFormContainer.classList.add("page-hidden");
                loginFormContainer.classList.remove("page-hidden");
            } else showToast(res.error,"error");
        });

    document.getElementById("reset-password-form")
        .addEventListener("submit",async e=>{
            e.preventDefault();
            const res=await api("/reset_password","POST",{
                email:document.getElementById("reset-email").value,
                new_password:document.getElementById("reset-password").value
            });
            if(res.success){
                showToast("Password updated!");
                forgotPasswordContainer.classList.add("page-hidden");
                loginFormContainer.classList.remove("page-hidden");
            } else showToast(res.error,"error");
        });

    if(getToken()) showApp();
    else showAuth();
});
