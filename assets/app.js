function startCountdown() {
    const timerDisplay = document.getElementById('countdown-timer');

    function updateTimer() {
        const now = new Date();
        // Create a target time for 7:00 PM (19:00) today
        let targetTime = new Date();
        targetTime.setHours(19, 0, 0, 0);

        // If it is currently past 7:00 PM, set the target to 7:00 PM tomorrow
        if (now > targetTime) {
            targetTime.setDate(targetTime.getDate() + 1);
        }

        const diff = targetTime - now;

        // Calculate hours, minutes, and seconds
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        // Format with leading zeros for visual consistency (e.g., 04m 09s)
        const formattedHours = String(hours).padStart(2, '0');
        const formattedMins = String(minutes).padStart(2, '0');
        const formattedSecs = String(seconds).padStart(2, '0');

        timerDisplay.innerText = `${formattedHours}h ${formattedMins}m ${formattedSecs}s`;
    }

    // Update immediately, then every 1000 milliseconds
    updateTimer();
    setInterval(updateTimer, 1000);
}

// Start the clock when the page loads
document.addEventListener('DOMContentLoaded', startCountdown);


let currentBasePrice = 2000; // Default base price
let currentTotal = 2000;

// --- Tab Switching ---
const tabs = document.querySelectorAll('.tab');
const categories = document.querySelectorAll('.menu-category');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        categories.forEach(c => c.classList.remove('active-category'));
        tab.classList.add('active');
        document.getElementById(tab.getAttribute('data-target')).classList.add('active-category');
    });
});

// --- Slide Panel & Calculator Initialization ---
const slidePanel = document.getElementById('slidePanel');
const panelOverlay = document.getElementById('panelOverlay');
const selectedItemName = document.getElementById('selectedItemName');
const selectedItemDesc = document.getElementById('selectedItemDesc');

function openPanel(itemName, itemDesc, basePrice) {
    selectedItemName.innerText = itemName;
    selectedItemDesc.innerText = itemDesc;
    currentBasePrice = basePrice; 
    
    // Reset form and recalculate before showing
    document.getElementById('orderForm').reset();
    calculateTotal(); 

    slidePanel.classList.add('open');
    panelOverlay.classList.add('active');
}

function closePanel() {
    slidePanel.classList.remove('open');
    panelOverlay.classList.remove('active');
}

// --- Live Price Calculator ---
function calculateTotal() {
    const platesInput = document.getElementById('plates').value;
    const plates = parseInt(platesInput) > 0 ? parseInt(platesInput) : 1;
    
    let addonsCost = 0;
    // Find all checked add-ons and add their data-price
    const checkedAddons = document.querySelectorAll('input[name="addon"]:checked');
    checkedAddons.forEach(addon => {
        addonsCost += parseInt(addon.getAttribute('data-price'));
    });

    // Formula: (Base Meal + Addons for that meal) * Number of Plates
    currentTotal = (currentBasePrice + addonsCost) * plates;
    
    // Display formatted currency
    document.getElementById('displayTotal').innerText = '₦' + currentTotal.toLocaleString();
}

// Attach the calculator to inputs so it updates live
document.getElementById('plates').addEventListener('input', calculateTotal);
const addonCheckboxes = document.querySelectorAll('input[name="addon"]');
addonCheckboxes.forEach(cb => cb.addEventListener('change', calculateTotal));


// --- Time Cutoff Logic ---
function checkTime() {
    const currentHour = new Date().getHours();
    const submitBtn = document.querySelector('.submit-btn');

    // NOTE: If it's currently past 8 PM WAT, this will lock! 
    if (currentHour >= 19) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Orders Closed (Past 7:00 PM)";
        
        const foodCards = document.querySelectorAll('.food-card');
        foodCards.forEach(card => {
            card.onclick = () => alert("Pre-orders are closed for tomorrow. Check back in the morning!");
        });
    }
}
checkTime();

// --- Form Submission ---
document.getElementById('orderForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.innerText = "Processing Order...";
    submitBtn.disabled = true;

    // Get a list of the text values for checked addons (e.g., "Extra Protein, Moi-Moi")
    const checkedAddons = Array.from(document.querySelectorAll('input[name="addon"]:checked'))
                               .map(cb => cb.value)
                               .join(', ');

    // *** PASTE YOUR GOOGLE APPS SCRIPT URL HERE ***
    const scriptURL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';

    const data = {
        name: document.getElementById('customerName').value,
        phone: document.getElementById('phone').value,
        floor: document.getElementById('floorNumber').value,
        plates: document.getElementById('plates').value,
        meal: document.getElementById('selectedItemName').innerText,
        addons: checkedAddons || "None", // Send "None" if empty
        totalPrice: currentTotal
    };

    try {
        await fetch(scriptURL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        document.querySelector('.panel-content').innerHTML = `
            <h2 style="color: var(--yellow);">> Order Logged!</h2>
            <p style="margin-top: 15px;">We've received your order for ${data.plates}x ${data.meal}.</p>
            <p style="margin-top: 5px; color: #ccc;">Add-ons: ${data.addons}</p>
            <div style="background: var(--black); border-left: 4px solid var(--yellow); padding: 15px; margin-top: 15px;">
                Total Expected Transfer: <strong>₦${data.totalPrice.toLocaleString()}</strong>
            </div>
            <p style="margin-top: 15px;">Delivery to Floor ${data.floor} tomorrow.</p>
            <button class="submit-btn" style="margin-top: 30px;" onclick="location.reload()">Return to Menu</button>
        `;
    } catch (error) {
        alert("Network error. Please try submitting again.");
        submitBtn.innerText = "Confirm & Submit Order";
        submitBtn.disabled = false;
    }
});
