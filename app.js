// Global Variables
let currentTrip = null;
let allTrips = [];

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

function toggleAuthForm() {
    document.getElementById('loginForm').classList.toggle('hidden');
    document.getElementById('signupForm').classList.toggle('hidden');
    document.getElementById('loginError').textContent = '';
    document.getElementById('signupError').textContent = '';
}

async function signup() {
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const errorDiv = document.getElementById('signupError');

    if (!email || !password) {
        errorDiv.textContent = 'Please fill in all fields';
        return;
    }

    try {
        await window.createUserWithEmailAndPassword(window.auth, email, password);
        await window.signOut(window.auth);
        errorDiv.style.color = '#27ae60';
        errorDiv.textContent = 'Account created! Please log in.';
        document.getElementById('signupEmail').value = '';
        document.getElementById('signupPassword').value = '';
        setTimeout(() => toggleAuthForm(), 1500);
    } catch (error) {
        errorDiv.style.color = '';
        if (error.code === 'auth/email-already-in-use') {
            errorDiv.textContent = 'This email is already registered. Please login instead.';
        } else if (error.code === 'auth/weak-password') {
            errorDiv.textContent = 'Password must be at least 6 characters.';
        } else if (error.code === 'auth/invalid-email') {
            errorDiv.textContent = 'Please enter a valid email address.';
        } else {
            errorDiv.textContent = 'Registration failed. Please try again.';
        }
    }
}

async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (!email || !password) {
        errorDiv.textContent = 'Please fill in all fields';
        return;
    }

    try {
        await window.signInWithEmailAndPassword(window.auth, email, password);
        errorDiv.textContent = '';
    } catch (error) {
        if (error.code === 'auth/too-many-requests') {
            errorDiv.textContent = 'Account temporarily blocked due to too many failed attempts. Please try again later or reset your password.';
        } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            errorDiv.textContent = 'Invalid email or password. Please try again.';
        } else if (error.code === 'auth/invalid-email') {
            errorDiv.textContent = 'Please enter a valid email address.';
        } else {
            errorDiv.textContent = 'Login failed. Please try again.';
        }
    }
}

async function logout() {
    try {
        await window.signOut(window.auth);
        currentTrip = null;
        allTrips = [];
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

function showApp(user) {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userEmail').textContent = user.email;
    loadTrips();
}

function showAuth() {
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('appContainer').style.display = 'none';
}

// ============================================
// TRIP MANAGEMENT FUNCTIONS
// ============================================

async function loadTrips() {
    const user = window.auth.currentUser;
    if (!user) return;

    try {
        const q = window.query(
            window.collection(window.db, 'trips'),
            window.where('userId', '==', user.uid)
        );
        const querySnapshot = await window.getDocs(q);

        allTrips = [];
        querySnapshot.forEach((doc) => {
            allTrips.push({ id: doc.id, ...doc.data() });
        });

        // Sort trips by start date
        allTrips.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        renderTripList();
        updateDashboard();
    } catch (error) {
        console.error('Error loading trips:', error);
    }
}

function renderTripList() {
    const tripList = document.getElementById('tripList');

    if (allTrips.length === 0) {
        tripList.innerHTML = '<li style="text-align:center;color:#999;padding:20px;">No trips yet</li>';
        return;
    }

    tripList.innerHTML = allTrips.map(trip => `
        <li class="trip-item ${currentTrip && currentTrip.id === trip.id ? 'active' : ''}" 
            onclick="selectTrip('${trip.id}')">
            <div class="trip-name">${trip.name}</div>
            <div class="trip-dates">${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}</div>
        </li>
    `).join('');
}

function selectTrip(tripId) {
    currentTrip = allTrips.find(t => t.id === tripId);
    if (!currentTrip) return;

    // Initialize arrays if they don't exist
    if (!currentTrip.packingList) currentTrip.packingList = [];
    if (!currentTrip.itinerary) currentTrip.itinerary = [];
    if (!currentTrip.expenses) currentTrip.expenses = [];

    renderTripList();
    renderTripDetails();
}

function renderTripDetails() {
    if (!currentTrip) {
        document.getElementById('contentArea').innerHTML = `
            <div class="no-trip-selected">
                <div class="no-trip-icon">✈️</div>
                <h3>Select a trip to get started</h3>
                <p>Or create a new trip to begin planning your adventure</p>
            </div>
        `;
        return;
    }

    document.getElementById('contentArea').innerHTML = `
        <div class="trip-header">
            <h2>${currentTrip.name}</h2>
            <button class="btn btn-danger btn-small" onclick="deleteTrip('${currentTrip.id}')">🗑️ Delete Trip</button>
        </div>
        <div class="tabs">
            <button class="tab active" onclick="switchTab('overview')">📊 Overview</button>
            <button class="tab" onclick="switchTab('packing')">🎒 Packing List</button>
            <button class="tab" onclick="switchTab('itinerary')">📅 Itinerary</button>
            <button class="tab" onclick="switchTab('budget')">💰 Budget</button>
        </div>
        <div class="tab-content active" id="overviewTab"></div>
        <div class="tab-content" id="packingTab"></div>
        <div class="tab-content" id="itineraryTab"></div>
        <div class="tab-content" id="budgetTab"></div>
    `;

    renderOverview();
    renderPacking();
    renderItinerary();
    renderBudget();
}

function switchTab(tabName) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Add active class to selected tab
    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
}

// ============================================
// OVERVIEW TAB
// ============================================

function renderOverview() {
    const daysUntil = Math.ceil((new Date(currentTrip.startDate) - new Date()) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((new Date(currentTrip.endDate) - new Date(currentTrip.startDate)) / (1000 * 60 * 60 * 24)) + 1;
    const totalExpenses = (currentTrip.expenses || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const remaining = currentTrip.budget - totalExpenses;
    const packingProgress = currentTrip.packingList ? 
        Math.round((currentTrip.packingList.filter(i => i.checked).length / currentTrip.packingList.length) * 100) || 0 : 0;

    const status = daysUntil > 0 ? '🟢 Upcoming' : daysUntil === 0 ? '🔴 Today!' : '✅ Completed';

    document.getElementById('overviewTab').innerHTML = `
        <div class="overview-grid">
            <div class="overview-card">
                <div class="overview-card-icon">📍</div>
                <div class="overview-card-value">${currentTrip.destination}</div>
                <div class="overview-card-label">Destination</div>
            </div>
            <div class="overview-card">
                <div class="overview-card-icon">⏰</div>
                <div class="overview-card-value">${daysUntil > 0 ? daysUntil : 0}</div>
                <div class="overview-card-label">Days Until Trip</div>
            </div>
            <div class="overview-card">
                <div class="overview-card-icon">📅</div>
                <div class="overview-card-value">${duration}</div>
                <div class="overview-card-label">Trip Duration</div>
            </div>
            <div class="overview-card">
                <div class="overview-card-icon">💰</div>
                <div class="overview-card-value">$${currentTrip.budget}</div>
                <div class="overview-card-label">Total Budget</div>
            </div>
            <div class="overview-card">
                <div class="overview-card-icon">💸</div>
                <div class="overview-card-value">$${totalExpenses.toFixed(2)}</div>
                <div class="overview-card-label">Total Spent</div>
            </div>
            <div class="overview-card">
                <div class="overview-card-icon">💵</div>
                <div class="overview-card-value" style="color: ${remaining >= 0 ? '#27ae60' : '#e74c3c'}">
                    $${Math.abs(remaining).toFixed(2)}
                </div>
                <div class="overview-card-label">${remaining >= 0 ? 'Remaining' : 'Over Budget'}</div>
            </div>
            <div class="overview-card">
                <div class="overview-card-icon">🎒</div>
                <div class="overview-card-value">${packingProgress}%</div>
                <div class="overview-card-label">Packing Complete</div>
            </div>
            <div class="overview-card">
                <div class="overview-card-icon">📋</div>
                <div class="overview-card-value">${(currentTrip.itinerary || []).length}</div>
                <div class="overview-card-label">Activities Planned</div>
            </div>
        </div>
        <div style="margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 12px;">
            <h3 style="color: #333; margin-bottom: 10px;">Trip Status</h3>
            <p style="font-size: 18px; font-weight: 600;">${status}</p>
            <p style="color: #777; margin-top: 10px;">
                ${formatDate(currentTrip.startDate)} - ${formatDate(currentTrip.endDate)}
            </p>
        </div>
    `;
}

// ============================================
// PACKING LIST TAB
// ============================================

function renderPacking() {
    const categories = ['Clothes', 'Electronics', 'Documents', 'Toiletries'];
    const packingList = currentTrip.packingList || [];

    let html = `
        <div class="packing-header">
            <h3>Packing List</h3>
            <button class="btn btn-small" onclick="openAddPackingModal()">+ Add Item</button>
        </div>
    `;

    categories.forEach(category => {
        const items = packingList.filter(item => item.category === category);
        const categoryIcon = {
            'Clothes': '👕',
            'Electronics': '📱',
            'Documents': '📄',
            'Toiletries': '🧴'
        }[category];

        html += `
            <div class="packing-category">
                <h4>${categoryIcon} ${category}</h4>
        `;

        if (items.length === 0) {
            html += `<p style="color: #999; font-size: 14px; margin-left: 20px;">No items in this category</p>`;
        } else {
            items.forEach((item, index) => {
                html += `
                    <div class="packing-item ${item.checked ? 'checked' : ''}">
                        <input type="checkbox" ${item.checked ? 'checked' : ''} 
                               onchange="togglePackingItem(${packingList.indexOf(item)})">
                        <span class="packing-item-text">${item.name}</span>
                        <span class="delete-icon" onclick="deletePackingItem(${packingList.indexOf(item)})">×</span>
                    </div>
                `;
            });
        }

        html += `</div>`;
    });

    if (packingList.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-state-icon">🎒</div>
                <p>No packing items yet. Start adding items to your list!</p>
            </div>
        `;
    }

    document.getElementById('packingTab').innerHTML = html;
}

async function togglePackingItem(index) {
    currentTrip.packingList[index].checked = !currentTrip.packingList[index].checked;
    await updateTrip();
    renderPacking();
    renderOverview();
}

async function deletePackingItem(index) {
    currentTrip.packingList.splice(index, 1);
    await updateTrip();
    renderPacking();
}

function openAddPackingModal() {
    document.getElementById('addPackingModal').classList.add('active');
    document.getElementById('packingItemName').value = '';
}

function closeAddPackingModal() {
    document.getElementById('addPackingModal').classList.remove('active');
}

async function addPackingItem() {
    const category = document.getElementById('packingCategory').value;
    const name = document.getElementById('packingItemName').value.trim();

    if (!name) {
        alert('Please enter an item name');
        return;
    }

    if (!currentTrip.packingList) {
        currentTrip.packingList = [];
    }

    currentTrip.packingList.push({
        category,
        name,
        checked: false
    });

    await updateTrip();
    renderPacking();
    closeAddPackingModal();
}

// ============================================
// ITINERARY TAB
// ============================================

function renderItinerary() {
    const itinerary = currentTrip.itinerary || [];

    let html = `
        <div class="itinerary-header">
            <h3>Daily Itinerary</h3>
            <button class="btn btn-small" onclick="openAddActivityModal()">+ Add Activity</button>
        </div>
    `;

    if (itinerary.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <p>No activities planned yet. Start building your itinerary!</p>
            </div>
        `;
    } else {
        // Group activities by date
        const groupedByDate = {};
        itinerary.forEach(activity => {
            if (!groupedByDate[activity.date]) {
                groupedByDate[activity.date] = [];
            }
            groupedByDate[activity.date].push(activity);
        });

        // Sort dates
        const sortedDates = Object.keys(groupedByDate).sort();

        sortedDates.forEach(date => {
            const activities = groupedByDate[date].sort((a, b) => a.time.localeCompare(b.time));
            html += `
                <div class="itinerary-day">
                    <h4>${formatDate(date)}</h4>
            `;

            activities.forEach(activity => {
                const index = itinerary.indexOf(activity);
                html += `
                    <div class="activity">
                        <div class="activity-info">
                            <div class="activity-time">⏰ ${formatTime(activity.time)}</div>
                            <div class="activity-name">${activity.name}</div>
                            <div class="activity-location">📍 ${activity.location}</div>
                            ${activity.notes ? `<div class="activity-notes">${activity.notes}</div>` : ''}
                        </div>
                        <div class="activity-delete" onclick="deleteActivity(${index})">×</div>
                    </div>
                `;
            });

            html += `</div>`;
        });
    }

    document.getElementById('itineraryTab').innerHTML = html;
}

function openAddActivityModal() {
    document.getElementById('addActivityModal').classList.add('active');
    document.getElementById('activityDate').value = currentTrip.startDate;
    document.getElementById('activityTime').value = '';
    document.getElementById('activityName').value = '';
    document.getElementById('activityLocation').value = '';
    document.getElementById('activityNotes').value = '';
}

function closeAddActivityModal() {
    document.getElementById('addActivityModal').classList.remove('active');
}

async function addActivity() {
    const date = document.getElementById('activityDate').value;
    const time = document.getElementById('activityTime').value;
    const name = document.getElementById('activityName').value.trim();
    const location = document.getElementById('activityLocation').value.trim();
    const notes = document.getElementById('activityNotes').value.trim();

    if (!date || !time || !name || !location) {
        alert('Please fill in all required fields');
        return;
    }

    if (!currentTrip.itinerary) {
        currentTrip.itinerary = [];
    }

    currentTrip.itinerary.push({
        date,
        time,
        name,
        location,
        notes
    });

    await updateTrip();
    renderItinerary();
    renderOverview();
    closeAddActivityModal();
}

async function deleteActivity(index) {
    if (confirm('Are you sure you want to delete this activity?')) {
        currentTrip.itinerary.splice(index, 1);
        await updateTrip();
        renderItinerary();
        renderOverview();
    }
}

// ============================================
// BUDGET TAB
// ============================================

function renderBudget() {
    const expenses = currentTrip.expenses || [];
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const remaining = currentTrip.budget - totalExpenses;
    const percentSpent = (totalExpenses / currentTrip.budget) * 100;

    let html = `
        <div class="budget-header">
            <h3>Budget Tracker</h3>
            <button class="btn btn-small" onclick="openAddExpenseModal()">+ Add Expense</button>
        </div>

        <div class="budget-summary">
            <div class="budget-card">
                <div class="budget-card-value">$${currentTrip.budget}</div>
                <div class="budget-card-label">Total Budget</div>
            </div>
            <div class="budget-card spent">
                <div class="budget-card-value">$${totalExpenses.toFixed(2)}</div>
                <div class="budget-card-label">Total Spent</div>
            </div>
            <div class="budget-card remaining">
                <div class="budget-card-value" style="color: ${remaining >= 0 ? '#27ae60' : '#e74c3c'}">
                    $${Math.abs(remaining).toFixed(2)}
                </div>
                <div class="budget-card-label">${remaining >= 0 ? 'Remaining' : 'Over Budget'}</div>
            </div>
            <div class="budget-card">
                <div class="budget-card-value">${percentSpent.toFixed(1)}%</div>
                <div class="budget-card-label">Budget Used</div>
            </div>
        </div>

        <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(percentSpent, 100)}%; background: ${percentSpent > 100 ? '#e74c3c' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}"></div>
        </div>

        <h3 style="margin-top: 30px; margin-bottom: 20px; color: #333;">Expenses</h3>
    `;

    if (expenses.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-state-icon">💰</div>
                <p>No expenses recorded yet. Start tracking your spending!</p>
            </div>
        `;
    } else {
        // Sort expenses by date (newest first)
        const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

        html += `<div class="expenses-list">`;
        sortedExpenses.forEach(expense => {
            const index = expenses.indexOf(expense);
            const categoryIcon = {
                'Accommodation': '🏨',
                'Transportation': '🚗',
                'Food': '🍽️',
                'Activities': '🎭',
                'Shopping': '🛍️',
                'Other': '📦'
            }[expense.category] || '📦';

            html += `
                <div class="expense-item">
                    <div class="expense-info">
                        <div class="expense-category">${categoryIcon} ${expense.category}</div>
                        <div class="expense-description">${expense.description}</div>
                        <div class="expense-date">${formatDate(expense.date)}</div>
                    </div>
                    <div class="expense-right">
                        <div class="expense-amount">$${parseFloat(expense.amount).toFixed(2)}</div>
                        <div class="expense-delete" onclick="deleteExpense(${index})">×</div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }

    document.getElementById('budgetTab').innerHTML = html;
}

function openAddExpenseModal() {
    document.getElementById('addExpenseModal').classList.add('active');
    document.getElementById('expenseDescription').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
}

function closeAddExpenseModal() {
    document.getElementById('addExpenseModal').classList.remove('active');
}

async function addExpense() {
    const category = document.getElementById('expenseCategory').value;
    const description = document.getElementById('expenseDescription').value.trim();
    const amount = document.getElementById('expenseAmount').value;
    const date = document.getElementById('expenseDate').value;

    if (!description || !amount || !date) {
        alert('Please fill in all fields');
        return;
    }

    if (parseFloat(amount) <= 0) {
        alert('Amount must be greater than 0');
        return;
    }

    if (!currentTrip.expenses) {
        currentTrip.expenses = [];
    }

    currentTrip.expenses.push({
        category,
        description,
        amount: parseFloat(amount),
        date
    });

    await updateTrip();
    renderBudget();
    renderOverview();
    updateDashboard();
    closeAddExpenseModal();
}

async function deleteExpense(index) {
    if (confirm('Are you sure you want to delete this expense?')) {
        currentTrip.expenses.splice(index, 1);
        await updateTrip();
        renderBudget();
        renderOverview();
        updateDashboard();
    }
}

// ============================================
// ADD TRIP MODAL
// ============================================

function openAddTripModal() {
    document.getElementById('addTripModal').classList.add('active');
    document.getElementById('newTripName').value = '';
    document.getElementById('newTripDestination').value = '';
    document.getElementById('newTripStartDate').value = '';
    document.getElementById('newTripEndDate').value = '';
    document.getElementById('newTripBudget').value = '';
    document.getElementById('addTripError').textContent = '';
}

function closeAddTripModal() {
    document.getElementById('addTripModal').classList.remove('active');
}

async function addTrip() {
    const name = document.getElementById('newTripName').value.trim();
    const destination = document.getElementById('newTripDestination').value.trim();
    const startDate = document.getElementById('newTripStartDate').value;
    const endDate = document.getElementById('newTripEndDate').value;
    const budget = document.getElementById('newTripBudget').value;
    const errorDiv = document.getElementById('addTripError');

    if (!name || !destination || !startDate || !endDate || !budget) {
        errorDiv.textContent = 'Please fill in all fields';
        return;
    }

    if (new Date(endDate) < new Date(startDate)) {
        errorDiv.textContent = 'End date must be after start date';
        return;
    }

    if (parseFloat(budget) <= 0) {
        errorDiv.textContent = 'Budget must be greater than 0';
        return;
    }

    const user = window.auth.currentUser;
    if (!user) return;

    try {
        const tripData = {
            name,
            destination,
            startDate,
            endDate,
            budget: parseFloat(budget),
            userId: user.uid,
            packingList: [],
            itinerary: [],
            expenses: [],
            createdAt: new Date().toISOString()
        };

        await window.addDoc(window.collection(window.db, 'trips'), tripData);
        closeAddTripModal();
        await loadTrips();
    } catch (error) {
        errorDiv.textContent = 'Error creating trip: ' + error.message;
    }
}

async function deleteTrip(tripId) {
    if (!confirm('Are you sure you want to delete this trip? This action cannot be undone.')) {
        return;
    }

    try {
        await window.deleteDoc(window.doc(window.db, 'trips', tripId));
        currentTrip = null;
        await loadTrips();
        renderTripDetails();
    } catch (error) {
        console.error('Error deleting trip:', error);
        alert('Error deleting trip. Please try again.');
    }
}

async function updateTrip() {
    if (!currentTrip || !currentTrip.id) return;

    try {
        const { id, ...tripData } = currentTrip;
        await window.updateDoc(window.doc(window.db, 'trips', id), tripData);
        
        // Update the trip in allTrips array
        const index = allTrips.findIndex(t => t.id === id);
        if (index !== -1) {
            allTrips[index] = { ...currentTrip };
        }
        
        updateDashboard();
    } catch (error) {
        console.error('Error updating trip:', error);
    }
}

// ============================================
// DASHBOARD FUNCTIONS
// ============================================

function updateDashboard() {
    const now = new Date();
    const upcomingTrips = allTrips.filter(trip => new Date(trip.startDate) >= now);
    const totalBudget = allTrips.reduce((sum, trip) => sum + (trip.budget || 0), 0);
    const totalSpent = allTrips.reduce((sum, trip) => {
        const expenses = trip.expenses || [];
        return sum + expenses.reduce((expSum, exp) => expSum + parseFloat(exp.amount || 0), 0);
    }, 0);

    document.getElementById('totalTrips').textContent = allTrips.length;
    document.getElementById('upcomingTrips').textContent = upcomingTrips.length;
    document.getElementById('totalBudget').textContent = '$' + totalBudget.toFixed(0);
    document.getElementById('totalSpent').textContent = '$' + totalSpent.toFixed(2);

    // Show next upcoming trip
    const upcomingTripCard = document.getElementById('upcomingTripCard');
    if (upcomingTrips.length > 0) {
        const nextTrip = upcomingTrips[0];
        const daysUntil = Math.ceil((new Date(nextTrip.startDate) - now) / (1000 * 60 * 60 * 24));
        
        upcomingTripCard.innerHTML = `
            <div class="upcoming-trip-card">
                <h3>🎯 Next Trip: ${nextTrip.name}</h3>
                <div class="upcoming-trip-info">
                    <div class="upcoming-trip-detail">
                        <div class="upcoming-trip-label">Destination</div>
                        <div class="upcoming-trip-value">${nextTrip.destination}</div>
                    </div>
                    <div class="upcoming-trip-detail">
                        <div class="upcoming-trip-label">Departure</div>
                        <div class="upcoming-trip-value">${formatDate(nextTrip.startDate)}</div>
                    </div>
                    <div class="upcoming-trip-detail">
                        <div class="upcoming-trip-label">Days Until</div>
                        <div class="upcoming-trip-value">${daysUntil} days</div>
                    </div>
                    <div class="upcoming-trip-detail">
                        <div class="upcoming-trip-label">Budget</div>
                        <div class="upcoming-trip-value">$${nextTrip.budget}</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        upcomingTripCard.innerHTML = '';
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(dateString) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Make functions globally available
window.toggleAuthForm = toggleAuthForm;
window.signup = signup;
window.login = login;
window.logout = logout;
window.showApp = showApp;
window.showAuth = showAuth;
window.openAddTripModal = openAddTripModal;
window.closeAddTripModal = closeAddTripModal;
window.addTrip = addTrip;
window.selectTrip = selectTrip;
window.deleteTrip = deleteTrip;
window.switchTab = switchTab;
window.openAddPackingModal = openAddPackingModal;
window.closeAddPackingModal = closeAddPackingModal;
window.addPackingItem = addPackingItem;
window.togglePackingItem = togglePackingItem;
window.deletePackingItem = deletePackingItem;
window.openAddActivityModal = openAddActivityModal;
window.closeAddActivityModal = closeAddActivityModal;
window.addActivity = addActivity;
window.deleteActivity = deleteActivity;
window.openAddExpenseModal = openAddExpenseModal;
window.closeAddExpenseModal = closeAddExpenseModal;
window.addExpense = addExpense;
window.deleteExpense = deleteExpense;
    