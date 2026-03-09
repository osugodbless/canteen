document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. COUNTDOWN TIMER LOGIC
    // ==========================================
    const timerDisplay = document.getElementById('countdown-timer');
    
    if (timerDisplay) {
        function updateTimer() {
            const now = new Date();
            // Target time is 7:00 PM (19:00) local time. 
            // Since you are operating in Lagos, this automatically syncs perfectly with WAT.
            let targetTime = new Date();
            targetTime.setHours(19, 0, 0, 0);

            if (now > targetTime) {
                targetTime.setDate(targetTime.getDate() + 1);
            }

            const diff = targetTime - now;
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const formattedHours = String(hours).padStart(2, '0');
            const formattedMins = String(minutes).padStart(2, '0');
            const formattedSecs = String(seconds).padStart(2, '0');

            timerDisplay.innerText = `${formattedHours}h ${formattedMins}m ${formattedSecs}s`;
        }

        updateTimer();
        setInterval(updateTimer, 1000);
    }

    // ==========================================
    // 2. TAB SWITCHING LOGIC
    // ==========================================
    const tabs = document.querySelectorAll('.tab');
    if (tabs.length > 0) {
        const categories = document.querySelectorAll('.menu-category');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                categories.forEach(c => c.classList.remove('active-category'));
                tab.classList.add('active');
                document.getElementById(tab.getAttribute('data-target')).classList.add('active-category');
            });
        });
    }

    // ==========================================
    // 3. LIVE PRICE CALCULATOR LOGIC
    // ==========================================
    const platesInput = document.getElementById('plates');
    const addonCheckboxes = document.querySelectorAll('input[name="addon"]');
    
    if (platesInput) {
        platesInput.addEventListener('input', calculateTotal);
        addonCheckboxes.forEach(cb => cb.addEventListener('change', calculateTotal));
    }

    // ==========================================
    // 4. TIME CUTOFF LOGIC
    // ==========================================
    function checkTime() {
        const currentHour = new Date().getHours();
        const submitBtn = document.querySelector('.submit-btn');

        if (submitBtn && currentHour >= 19) {
            submitBtn.disabled = true;
            submitBtn.innerText = "Orders Closed (Past 7:00 PM)";
            
            const foodCards = document.querySelectorAll('.food-card');
            foodCards.forEach(card => {
                card.onclick = () => alert("Pre-orders are closed for tomorrow. Check back in the morning!");
            });
        }
    }
    checkTime();

    // ==========================================
    // 5. AWS API GATEWAY FORM SUBMISSION
    // ==========================================
    const orderForm = document.getElementById('orderForm');
    
    if (orderForm) {
        orderForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.querySelector('.submit-btn');
            const originalText = submitBtn.innerText;
            submitBtn.innerText = "Processing Order...";
            submitBtn.disabled = true;

            // Gather an array of strings for the Go struct's Extras []string field
            const checkedExtras = Array.from(document.querySelectorAll('input[name="addon"]:checked'))
                                       .map(cb => cb.value);

            // Construct the strictly-typed payload to match your Go Struct
            const orderPayload = {
                item: document.getElementById('selectedItemName').innerText,
                extras: checkedExtras, // Sends an Array to match Go
                name: document.getElementById('customerName').value,
                phone: document.getElementById('phone').value,
                floor: parseInt(document.getElementById('floorNumber').value),
                plates: parseInt(document.getElementById('plates').value),
                total: currentTotal,
                timestamp: new Date().toISOString()
            };

            // *** PASTE YOUR AWS API GATEWAY URL HERE ***
            const API_URL = 'https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/Prod/submit-order';

            try {
                // Firing the request to AWS (Removed 'no-cors' so API Gateway responds correctly)
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderPayload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                // Inject your beautifully styled success UI
                const addonsDisplay = checkedExtras.length > 0 ? checkedExtras.join(', ') : "None";
                document.querySelector('.panel-content').innerHTML = `
                    <h2 style="color: var(--yellow);">> Order Logged!</h2>
                    <p style="margin-top: 15px;">We've received your order for ${orderPayload.plates}x ${orderPayload.item}.</p>
                    <p style="margin-top: 5px; color: #ccc;">Add-ons: ${addonsDisplay}</p>
                    <div style="background: var(--black); border-left: 4px solid var(--yellow); padding: 15px; margin-top: 15px;">
                        Total Expected Transfer: <strong>₦${orderPayload.total.toLocaleString()}</strong>
                    </div>
                    <p style="margin-top: 15px;">Delivery to Floor ${orderPayload.floor} tomorrow.</p>
                    <button class="submit-btn" style="margin-top: 30px;" onclick="location.reload()">Return to Menu</button>
                `;

            } catch (error) {
                console.error("Submission failed:", error);
                alert("Network error. Please try submitting again.");
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});

// ==========================================
// 6. GLOBAL FUNCTIONS (Kept outside DOMContentLoaded for HTML onclick access)
// ==========================================
let currentBasePrice = 2000; 
let currentTotal = 2000;

function openPanel(itemName, itemDesc, basePrice) {
    document.getElementById('selectedItemName').innerText = itemName;
    document.getElementById('selectedItemDesc').innerText = itemDesc;
    currentBasePrice = basePrice; 
    
    const form = document.getElementById('orderForm');
    if (form) form.reset();
    
    calculateTotal(); 

    document.getElementById('slidePanel').classList.add('open');
    document.getElementById('panelOverlay').classList.add('active');
}

function closePanel() {
    document.getElementById('slidePanel').classList.remove('open');
    document.getElementById('panelOverlay').classList.remove('active');
}

function calculateTotal() {
    const platesInput = document.getElementById('plates');
    if (!platesInput) return; // Defensive check

    const plates = parseInt(platesInput.value) > 0 ? parseInt(platesInput.value) : 1;
    let addonsCost = 0;
    
    const checkedAddons = document.querySelectorAll('input[name="addon"]:checked');
    checkedAddons.forEach(addon => {
        addonsCost += parseInt(addon.getAttribute('data-price'));
    });

    currentTotal = (currentBasePrice + addonsCost) * plates;
    document.getElementById('displayTotal').innerText = '₦' + currentTotal.toLocaleString();
}