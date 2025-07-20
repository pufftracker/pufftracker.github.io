const scriptUrl = "https://script.google.com/macros/s/AKfycbzKg11NH2_fOH2WFgBA7ZVd7frSVZz2rdjfAiIw_Brbv6C-zvLhqns7dLsRNY3vnor-/exec";
const userID = localStorage.getItem('puffTrackerUserID');
const token = localStorage.getItem('puffTrackerToken');
const nickname = localStorage.getItem('puffTrackerNickname');
const email = localStorage.getItem('puffTrackerEmail');

// --- AUTHENTICATION CHECK ---
if (!userID || !token || !nickname || !email) {
    window.location.href = 'login.html';
}

let dailyTrendChart;
let moodDistributionChart;
let locationDistributionChart;
let timeSinceLastInterval;
let allUserData = [];

// --- HELPER FUNCTIONS ---
function getLocalISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLiveInterval(ms) {
    if (isNaN(ms) || ms < 0) return "--";
    let totalSeconds = Math.floor(ms / 1000);
    let hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = totalSeconds % 60;
    minutes = String(minutes).padStart(2, "0");
    seconds = String(seconds).padStart(2, "0");
    return `${hours}h ${minutes}m ${seconds}s`;
}

function formatStreakInterval(ms) {
    if (!ms || ms <= 0) return "--";
    let totalMinutes = Math.floor(ms / (1000 * 60));
    let totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    let result = "";
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h`;
    return result.trim() === "" ? "<1h" : result.trim();
}

function calculateLongestStreak(data) {
    if (data.length < 2) return "--";
    const timestamps = data.map(entry => new Date(entry.timestamp)).sort((a, b) => a - b);
    let currentLongest = 0;
    for (let i = 1; i < timestamps.length; i++) {
        if (!isNaN(timestamps[i]) && !isNaN(timestamps[i-1])) {
            const interval = timestamps[i] - timestamps[i - 1];
            if (interval > currentLongest) {
                currentLongest = interval;
            }
        }
    }
    return formatStreakInterval(currentLongest);
}

function calculateBestDay(data) {
    if (data.length === 0) return "--";
    const dailyCounts = {};
    data.forEach(entry => {
        const date = entry.timestamp ? entry.timestamp.substring(0, 10) : getLocalISODate(new Date(entry.timestamp));
        dailyCounts[date] = (dailyCounts[date] || 0) + parseInt(entry.count);
    });
    let bestDayDate = null;
    let minCount = Infinity;
    
    const activeDays = Object.keys(dailyCounts).filter(date => dailyCounts[date] > 0);

    if (activeDays.length === 0) return "--";
    
    activeDays.sort((a, b) => new Date(a) - new Date(b));

    for (const date of activeDays) {
        if (dailyCounts[date] < minCount) {
            minCount = dailyCounts[date];
            bestDayDate = date;
        }
    }

    if (bestDayDate) {
        const dayName = new Date(bestDayDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
        return `${minCount} on ${dayName}`;
    }
    return "--";
}

function calculateTodaysInterval(data) {
    const todayStr = getLocalISODate();
    const todaysEntries = data.filter(entry => entry.entryDate === todayStr && entry.timestamp);
    
    if (todaysEntries.length < 2) {
        return "--";
    }
    
    const totalCigsToday = todaysEntries.reduce((sum, entry) => sum + parseInt(entry.count), 0);
    if (totalCigsToday < 2) {
        return "--";
    }

    const timestamps = todaysEntries.map(entry => new Date(entry.timestamp)).sort((a, b) => a - b);
    
    const firstCigTimestamp = timestamps[0];
    const lastCigTimestamp = timestamps[timestamps.length - 1];
    
    const totalDurationMs = lastCigTimestamp - firstCigTimestamp;
    const numberOfIntervals = totalCigsToday - 1;
    
    if (numberOfIntervals <= 0 || totalDurationMs <= 0) return "--";
    
    const avgIntervalMs = totalDurationMs / numberOfIntervals;
    return formatInterval(avgIntervalMs);
}

function formatInterval(ms) {
    if (!ms || ms <= 0) return "--";
    let totalMinutes = Math.floor(ms / (1000 * 60));
    if (totalMinutes < 1) return "<1m";
    let hours = Math.floor(totalMinutes / 60);
    let minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

// --- NEW HELPER FOR ADVANCED ANALYTICS ---
function getDistinctDates(data) {
    return [...new Set(data.map(e => e.entryDate))].sort((a, b) => new Date(a) - new Date(b));
}

function calculateAverage(data, period) {
    const distinctDates = getDistinctDates(data);
    if (distinctDates.length === 0) return 0;

    const dailyCounts = {};
    data.forEach(entry => {
        dailyCounts[entry.entryDate] = (dailyCounts[entry.entryDate] || 0) + parseInt(entry.count);
    });

    let totalPeriods = 0;
    let totalCount = 0;

    if (period === 'monthly') {
        const months = new Set(distinctDates.map(date => date.substring(0, 7)));
        totalPeriods = months.size;
        totalCount = data.reduce((sum, entry) => sum + parseInt(entry.count), 0);
    } else if (period === 'weekly') {
        let weekCounts = {};
        distinctDates.forEach(dateStr => {
            const date = new Date(dateStr + 'T00:00:00');
            const weekNum = getWeekNumber(date);
            const year = date.getFullYear();
            const weekKey = `${year}-${weekNum}`;
            weekCounts[weekKey] = (weekCounts[weekKey] || 0) + (dailyCounts[dateStr] || 0);
        });
        totalPeriods = Object.keys(weekCounts).length;
        totalCount = Object.values(weekCounts).reduce((sum, val) => sum + val, 0);
    } else {
        totalPeriods = distinctDates.length;
        totalCount = data.reduce((sum, entry) => sum + parseInt(entry.count), 0);
    }

    return totalPeriods > 0 ? (totalCount / totalPeriods).toFixed(1) : 0;
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return weekNo;
}

// --- TOAST NOTIFICATION FUNCTION ---
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.error("Toast container not found!");
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${message}`;
    
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
}

// Added for animating numbers
function animateNumber(element, start, end, duration) {
    let startTime = null;
    const step = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const currentValue = Math.floor(progress * (end - start) + start);
        element.textContent = currentValue;
        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            element.textContent = end;
        }
    };
    requestAnimationFrame(step);
}

// Stats Carousel Logic (Removed for Dashboard)
// The function initStatsCarousel and related logic has been removed as per request.

// Intersection Observer for animate-on-scroll elements
const animateOnScrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            animateOnScrollObserver.unobserve(entry.target); // Observe once
        }
    });
}, { root: null, rootMargin: '0px', threshold: 0.1 }); // Observe when 10% visible

function setupAnimateOnScroll() {
    // Stop observing old elements before observing new ones
    document.querySelectorAll('.animate-on-scroll.is-visible').forEach(el => el.classList.remove('is-visible')); // Reset state
    document.querySelectorAll('.animate-on-scroll').forEach(el => animateOnScrollObserver.unobserve(el)); // Clear old observations

    // Observe elements in the currently active section
    document.querySelectorAll('.content-section.active .animate-on-scroll').forEach(el => {
        animateOnScrollObserver.observe(el);
    });
}


// --- MAIN LOGIC ---
$(document).ready(function() {
    setupInitialUI();
    initializeComponents();
    setupNavigation(); // Calls setupAnimateOnScroll internally for initial load
    initializeCharts();
    loadData();
    loadGoals();
    $('body').append('<div id="toast-container"></div>');
    // initStatsCarousel(); // REMOVED as per request.
});

function setupInitialUI() {
    $('#welcome-message').html(`Welcome, <span>${nickname}</span>`);
    const currentDate = new Date();
    $('#current-date').text(currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    
    const today = getLocalISODate();
    $('#targetDate').attr('min', today);
}

function initializeComponents() {
    $('#logout-button').on('click', function() {
        localStorage.clear();
        clearInterval(timeSinceLastInterval);
        window.location.href = 'login.html';
    });
    $('.mood-option').click(function() {
        $('.mood-option').removeClass('selected');
        $(this).addClass('selected');
        $('#mood').val($(this).data('mood'));
    });
    $('#increment').click(() => $('#count').val(parseInt($('#count').val()) + 1));
    $('#decrement').click(() => $('#count').val(Math.max(1, parseInt($('#count').val()) - 1)));
    $('#submitLog').click(logEntry);

    $('#goalType').change(function() {
        const goalType = $(this).val();
        const hint = $('#targetValueHint');
        if (goalType === 'DailyReduction') {
            hint.text('e.g., "5" to reduce to 5 cigarettes per day.');
        } else if (goalType === 'LongestStreak') {
            hint.text('e.g., "30" for 30 smoke-free days.');
        } else {
            hint.text('');
        }
    });
    $('#saveGoal').click(saveGoal);
    
    $('#exportDataButton').click(exportData);
}

function setupNavigation() {
    $('.nav-item').click(function(e) {
        if ($(this).attr('href') && $(this).attr('href').startsWith('#')) {
            e.preventDefault();
            $('.nav-item').removeClass('active');
            $(this).addClass('active');
            $('.content-section').removeClass('active');
            $($(this).attr('href')).addClass('active');

            setupAnimateOnScroll(); // Set up animations for the newly active section

            const sectionId = $(this).attr('href');
            if (sectionId === '#dashboard' || sectionId === '#history' || sectionId === '#analytics') {
                loadData(); // Reload data for these sections
            } else if (sectionId === '#goals') {
                loadGoals(); // Load goals specifically
            }
        }
    });

    // Initial setup of animate-on-scroll for the default active dashboard section
    setupAnimateOnScroll();
}

function logEntry() {
    if (!$('#mood').val()) {
        $('#modal-alert').html('<div class="alert alert-danger">Please select a mood.</div>');
        return;
    }
    const countInput = $('#count');
    const countValue = Number(countInput.val());
    if (!Number.isInteger(countValue) || countValue < 1) {
        $('#modal-alert').html('<div class="alert alert-danger">Please enter a valid whole number (1 or higher).</div>');
        return;
    }
    $('#modal-alert').html('');
    const submitBtn = $('#submitLog');
    submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Saving...');
    const data = new URLSearchParams({
        action: 'logEntry',
        userID: userID,
        token: token,
        email: email,
        date: getLocalISODate(),
        time: new Date().toTimeString().split(' ')[0],
        count: countValue,
        mood: $('#mood').val(),
        location: $('#location').val() || '',
    });
    fetch(scriptUrl, { method: 'POST', body: data })
        .then(res => res.json())
        .then(response => {
            if (response.status === 'success') {
                $('#modal-alert').html('<div class="alert alert-success">Entry logged!</div>');
                setTimeout(() => {
                    $('#logModal').modal('hide');
                    $('#modal-alert').html('');
                    $('#entryForm')[0].reset();
                    $('#count').val(1);
                    $('.mood-option').removeClass('selected');
                }, 1500);
                loadData();
                loadGoals();
            } else {
                alert(response.message);
            }
        })
        .finally(() => submitBtn.prop('disabled', false).text('Save'));
}

function loadData() {
    // Reset all animated stat values to '...' before loading
    $('.stat-value-animated').text('...');
    $('#avgInterval, #longestStreak, #bestDay, #topTrigger, #secondaryTopTrigger').text('--');

    const url = `${scriptUrl}?action=loadData&userID=${userID}&token=${token}&email=${email}`;
    fetch(url)
        .then(res => res.json())
        .then(response => {
            if (response.status === 'success') {
                allUserData = response.records;
                processData(allUserData);
                processAdvancedAnalytics(allUserData);
            } else {
                alert(response.message);
                $('#logout-button').click();
            }
        })
        .catch(error => {
            console.error("Loading data failed:", error);
            alert("Could not load data from spreadsheet.");
        });
}

function processData(data) {
    const cleanData = data.map(entry => {
        if (entry.timestamp) {
            entry.entryDate = entry.timestamp.substring(0, 10);
        }
        return entry;
    });

    const today = getLocalISODate();
    const todayCount = cleanData.filter(entry => entry.entryDate === today).reduce((sum, entry) => sum + parseInt(entry.count), 0);
    animateNumber(document.getElementById('todayCount'), 0, todayCount, 800);

    const totalDays = [...new Set(cleanData.map(e => e.entryDate))].length;
    const totalCount = cleanData.reduce((sum, e) => sum + parseInt(e.count), 0);
    const avgDailyVal = totalDays > 0 ? parseFloat((totalCount / totalDays).toFixed(1)) : 0;
    animateNumber(document.getElementById('avgDaily'), 0, Math.round(avgDailyVal), 1000);

    const moodCounts = cleanData.reduce((acc, entry) => { acc[entry.mood] = (acc[entry.mood] || 0) + parseInt(entry.count); return acc; }, {});
    $('#topTrigger').text(Object.keys(moodCounts).length > 0 ? Object.entries(moodCounts).sort((a,b) => b[1]-a[1])[0][0] : '--');

    $('#avgInterval').text(calculateTodaysInterval(cleanData));
    $('#longestStreak').text(calculateLongestStreak(cleanData));
    $('#bestDay').text(calculateBestDay(cleanData));

    const historyBody = $('#historyTable tbody').empty();
    cleanData.forEach(entry => {
        const displayDate = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "Invalid Date";
        historyBody.append(`<tr><td>${displayDate}</td><td>${entry.count}</td><td><span class="badge bg-secondary">${entry.mood}</span></td><td>${entry.location || ''}</td></tr>`);
    });

    const trendLabels = [];
    const trendData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = getLocalISODate(d); 
        trendLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        trendData.push(cleanData.filter(entry => entry.entryDate === dateString).reduce((sum, entry) => sum + parseInt(entry.count), 0));
    }
    updateDailyTrendChart(trendLabels, trendData);

    if (timeSinceLastInterval) {
        clearInterval(timeSinceLastInterval);
    }
    if (cleanData.length > 0) {
        const lastLogTimestamp = new Date(cleanData[0].timestamp);
        timeSinceLastInterval = setInterval(() => {
            const now = new Date();
            const diffMs = now - lastLogTimestamp;
            $('#timeSinceLast').text(formatLiveInterval(diffMs));
        }, 1000);
    } else {
        $('#timeSinceLast').text('--');
    }
}

function processAdvancedAnalytics(data) {
    if (data.length === 0) {
        $('#totalSmoked').text(0);
        $('#totalDaysTracked').text(0);
        $('#secondaryTopTrigger').text('--');
        $('#avgMonthly').text(0);
        $('#avgWeekly').text(0);
        updateMoodDistributionChart([], []);
        updateLocationDistributionChart([], []);
        return;
    }

    const cleanData = data.map(entry => {
        if (entry.timestamp) {
            entry.entryDate = entry.timestamp.substring(0, 10);
        }
        return entry;
    });

    const totalSmoked = cleanData.reduce((sum, entry) => sum + parseInt(entry.count), 0);
    animateNumber(document.getElementById('totalSmoked'), 0, totalSmoked, 1200);

    const distinctDates = [...new Set(cleanData.map(e => e.entryDate))];
    animateNumber(document.getElementById('totalDaysTracked'), 0, distinctDates.length, 1000);

    const moodCounts = cleanData.reduce((acc, entry) => { acc[entry.mood] = (acc[entry.mood] || 0) + parseInt(entry.count); return acc; }, {});
    const sortedMoods = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);
    $('#secondaryTopTrigger').text(sortedMoods.length > 1 ? sortedMoods[1][0] : '--');

    const avgMonthlyVal = parseFloat(calculateAverage(cleanData, 'monthly'));
    animateNumber(document.getElementById('avgMonthly'), 0, Math.round(avgMonthlyVal), 1200);

    const avgWeeklyVal = parseFloat(calculateAverage(cleanData, 'weekly'));
    animateNumber(document.getElementById('avgWeekly'), 0, Math.round(avgWeeklyVal), 1100);

    // Mood Distribution Chart
    const moodLabels = sortedMoods.map(item => item[0]);
    const moodData = sortedMoods.map(item => item[1]);
    updateMoodDistributionChart(moodLabels, moodData);

    // Location Distribution Chart
    const locationCounts = cleanData.reduce((acc, entry) => { acc[entry.location || 'Unknown'] = (acc[entry.location || 'Unknown'] || 0) + parseInt(entry.count); return acc; }, {});
    const sortedLocations = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]);
    const locationLabels = sortedLocations.map(item => item[0]);
    const locationData = sortedLocations.map(item => item[1]);
    updateLocationDistributionChart(locationLabels, locationData);
}

function initializeCharts() {
    const ctxDaily = document.getElementById('dailyTrendChart').getContext('2d');
    dailyTrendChart = new Chart(ctxDaily, { type: 'line', data: { labels: [], datasets: [{ label: 'Smoked', data: [], borderColor: '#00ffab', backgroundColor: 'rgba(0, 255, 171, 0.1)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#00ffab', pointHoverRadius: 7, pointHoverBorderColor: '#fff' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false }, ticks: {color: '#a0a0a0'} }, y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: {color: '#a0a0a0', precision: 0} } }, plugins: { legend: { display: false }, tooltip: { enabled: true, backgroundColor: 'rgba(0, 0, 0, 0.8)', titleColor: '#fff', bodyColor: '#fff', padding: 10, cornerRadius: 8, displayColors: false, callbacks: { label: function(context) { return `Smoked: ${context.raw}`; } } } } } });

    const ctxMood = document.getElementById('moodDistributionChart').getContext('2d');
    moodDistributionChart = new Chart(ctxMood, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#00ffab', '#f4d03f', '#a569bd', '#e74c3c', '#3498db', '#90ee90'
                ],
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#e0e0e0'
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                            return `${label}: ${value} (${percentage})`;
                        }
                    }
                }
            }
        }
    });

    const ctxLocation = document.getElementById('locationDistributionChart').getContext('2d');
    locationDistributionChart = new Chart(ctxLocation, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Cigarettes',
                data: [],
                backgroundColor: '#00ffab',
                borderColor: '#00ffab',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#a0a0a0' }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#a0a0a0', precision: 0 }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `Smoked: ${context.raw}`;
                        }
                    }
                }
            }
        }
    });
}

function updateDailyTrendChart(labels, data) {
    if (!dailyTrendChart) return;
    dailyTrendChart.data.labels = labels;
    dailyTrendChart.data.datasets[0].data = data;
    dailyTrendChart.update();
}

function updateMoodDistributionChart(labels, data) {
    if (!moodDistributionChart) return;
    moodDistributionChart.data.labels = labels;
    moodDistributionChart.data.datasets[0].data = data;
    moodDistributionChart.update();
}

function updateLocationDistributionChart(labels, data) {
    if (!locationDistributionChart) return;
    locationDistributionChart.data.labels = labels;
    locationDistributionChart.data.datasets[0].data = data;
    locationDistributionChart.update();
}

function saveGoal() {
    const goalType = $('#goalType').val();
    const targetValue = $('#targetValue').val();
    const targetDate = $('#targetDate').val();

    if (!goalType || !targetValue || !targetDate) {
        $('#goal-modal-alert').html('<div class="alert alert-danger">Please fill all goal fields.</div>');
        return;
    }

    const saveBtn = $('#saveGoal');
    saveBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Saving...');
    
    const data = new URLSearchParams({
        action: 'saveGoal',
        userID: userID,
        token: token,
        email: email,
        goalType: goalType,
        targetValue: targetValue,
        targetDate: targetDate
    });

    fetch(scriptUrl, { method: 'POST', body: data })
        .then(res => res.json())
        .then(response => {
            if (response.status === 'success') {
                $('#goal-modal-alert').html('<div class="alert alert-success">Goal saved!</div>');
                setTimeout(() => {
                    $('#goalModal').modal('hide');
                    $('#goal-modal-alert').html('');
                    $('#goalForm')[0].reset();
                }, 1500);
                loadGoals();
            } else {
                $('#goal-modal-alert').html(`<div class="alert alert-danger">${response.message}</div>`);
            }
        })
        .catch(error => {
            console.error("Saving goal failed:", error);
            $('#goal-modal-alert').html('<div class="alert alert-danger">An error occurred while saving the goal.</div>');
        })
        .finally(() => saveBtn.prop('disabled', false).text('Save Goal'));
}

function loadGoals() {
    const url = `${scriptUrl}?action=loadGoals&userID=${userID}&token=${token}&email=${email}`;
    fetch(url)
        .then(res => res.json())
        .then(response => {
            if (response.status === 'success') {
                displayGoals(response.goals);
            } else {
                $('#goal-alert-container').html(`<div class="alert alert-danger">${response.message}</div>`);
                console.error("Loading goals failed:", response.message);
            }
        })
        .catch(error => {
            console.error("Loading goals failed:", error);
            $('#goal-alert-container').html('<div class="alert alert-danger">Could not load goals.</div>');
        });
}

function displayGoals(goals) {
    const activeGoalsContainer = $('#activeGoalsContainer').empty();
    const goalsHistoryTableBody = $('#goalsHistoryTable tbody').empty();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let hasActiveGoal = false;

    goals.sort((a, b) => new Date(a.startdate) - new Date(b.startdate));

    goals.forEach(goal => {
        const targetDate = new Date(goal.targetdate + 'T00:00:00');
        const startDate = new Date(goal.startdate + 'T00:00:00');

        const displayTargetDate = targetDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const displayStartDate = startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

        let status = 'Active';
        let progressValue = 0;
        let progressText = '--';

        if (goal.goaltype === 'DailyReduction') {
            const initialDailyCount = getDailyCountAtDate(startDate);
            const currentDailyCount = getDailyCountAtDate(today);

            if (initialDailyCount > 0) {
                 const reductionNeeded = initialDailyCount - parseInt(goal.targetvalue);
                 const currentReduction = initialDailyCount - currentDailyCount;
                 progressValue = (reductionNeeded > 0) ? Math.min(100, Math.max(0, (currentReduction / reductionNeeded) * 100)) : 100;
            } else {
                progressValue = currentDailyCount <= parseInt(goal.targetvalue) ? 100 : 0;
            }
            progressText = `Current: ${currentDailyCount} / Target: ${goal.targetvalue}`;

            if (currentDailyCount <= parseInt(goal.targetvalue)) {
                status = 'Achieved';
            } else if (today > targetDate) {
                status = 'Not Achieved';
            }

        } else if (goal.goaltype === 'LongestStreak') {
            const currentStreak = calculateCurrentSmokeFreeStreak();
            progressValue = Math.min(100, Math.max(0, (currentStreak / parseInt(goal.targetvalue)) * 100));
            progressText = `Current: ${currentStreak} / Target: ${goal.targetvalue} days`;

            if (currentStreak >= parseInt(goal.targetvalue)) {
                status = 'Achieved';
            } else if (today > targetDate) {
                status = 'Not Achieved';
            }
        }

        if (status === 'Active' && today > targetDate) {
            status = 'Overdue';
        }

        if (status === 'Active' || status === 'Overdue') {
            hasActiveGoal = true;
            activeGoalsContainer.append(`
                <div class="bento-box">
                    <div class="box-content">
                        <div class="stat-icon-wrapper"><i class="fas ${goal.goaltype === 'DailyReduction' ? 'fa-minus-circle' : 'fa-clock'} stat-icon"></i></div>
                        <div class="stat-label">Goal: ${goal.goaltype === 'DailyReduction' ? 'Reduce Daily' : 'Longest Streak'}</div>
                        <div class="stat-value-animated">${goal.targetvalue} ${goal.goaltype === 'DailyReduction' ? 'cigs' : 'days'}</div>
                        <small class="text-muted">Target by: ${displayTargetDate}</small><br>
                        <small class="text-info">${progressText}</small>
                        <div class="progress mt-2" style="height: 5px;">
                            <div class="progress-bar bg-primary" role="progressbar" style="width: ${progressValue}%" aria-valuenow="${progressValue}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                        <span class="badge ${status === 'Achieved' ? 'bg-success' : (status === 'Overdue' ? 'bg-danger' : 'bg-info')}">${status}</span>
                    </div>
                </div>
            `);
        }
        
        goalsHistoryTableBody.append(`
            <tr>
                <td>${goal.goaltype === 'DailyReduction' ? 'Reduce Daily' : 'Longest Streak'}</td>
                <td>${goal.targetvalue}</td>
                <td>${displayTargetDate}</td>
                <td>${progressText}</td>
                <td><span class="badge ${status === 'Achieved' ? 'bg-success' : (status === 'Overdue' ? 'bg-danger' : (status === 'Active' ? 'bg-info' : 'bg-secondary'))}">${status}</span></td>
                <td>${displayStartDate}</td>
            </tr>
        `);
    });

    if (!hasActiveGoal) {
        activeGoalsContainer.html('<p class="text-muted text-center py-4">No active goals. Set a new one!</p>');
    }
}

function getDailyCountAtDate(date) {
    const dateStr = getLocalISODate(date);
    const entriesOnDate = allUserData.filter(entry => entry.entryDate === dateStr);
    return entriesOnDate.reduce((sum, entry) => sum + parseInt(entry.count), 0);
}

function calculateCurrentSmokeFreeStreak() {
    if (allUserData.length === 0) return 0;

    const sortedEntries = allUserData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let lastSmokeDate = null;
    if (sortedEntries.length > 0) {
        lastSmokeDate = new Date(sortedEntries[sortedEntries.length - 1].timestamp);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (lastSmokeDate === null) {
        return 0;
    }

    lastSmokeDate.setHours(0, 0, 0, 0);

    const diffTime = today - lastSmokeDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
}

function exportData() {
    const exportBtn = $('#exportDataButton');
    exportBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Exporting...');

    const url = `${scriptUrl}?action=exportData&userID=${userID}&token=${token}&email=${email}`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'PuffTracker_Data_Export.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Data export initiated. Check your downloads folder!', 'success');
    
    setTimeout(() => {
        exportBtn.prop('disabled', false).html('<i class="fas fa-download"></i> Export Data');
    }, 1500);
}
