// ========== GLOBAL VARIABLES AND INITIALIZATION ==========
let currentUser = null;
let authToken = null;
const API_BASE = '/api';

// Pagination variables
let currentPaymentsPage = 1;
let totalPaymentsPages = 1;
let paymentsPerPage = 20;

let currentTeachersPage = 1;
let totalTeachersPages = 1;
let teachersPerPage = 10;

// Selected payments for bulk operations
let selectedPayments = new Set();

// DOM elements
const loginSection = document.getElementById('loginSection');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const userNameEl = document.getElementById('userName');
const userRoleEl = document.getElementById('userRole');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section');
const modals = document.querySelectorAll('.modal');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize the application
function initApp() {
    // Check if user is already logged in
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        showApp();
    } else {
        showLogin();
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data if logged in
    if (authToken) {
        loadInitialData();
    }
    initializeSettings();
}


function setupEventListeners() {
    // Login form submission
    loginForm.addEventListener('submit', handleLogin);
    
    // Logout button
    logoutBtn.addEventListener('click', handleLogout);
    
    // Navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            showSection(sectionId);
            
            // Update active class
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Close modals when clicking on X
    document.querySelectorAll('.close, [data-dismiss="modal"]').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', function(e) {
        modals.forEach(modal => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Select all payments checkbox
    document.getElementById('selectAllPayments').addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('#paymentsTable input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
            const paymentId = checkbox.getAttribute('data-id');
            if (this.checked) {
                selectedPayments.add(paymentId);
            } else {
                selectedPayments.delete(paymentId);
            }
        });
        updateSelectedPaymentsCount();
    });
    
    // Student filter search
    document.getElementById('paymentStudentFilter').addEventListener('input', debounce(loadPayments, 300));
}
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            
            // Save to localStorage
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            showApp();
            loadInitialData();
        } else {
            alert(`خطأ في تسجيل الدخول: ${data.error}`);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
        hideLoading();
    }
}

// Handle logout
function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    showLogin();
}

// Show login screen
function showLogin() {
    loginSection.style.display = 'flex';
    appContainer.style.display = 'none';
}


// Show main application
function showApp() {
    loginSection.style.display = 'none';
    appContainer.style.display = 'grid';
    
    // Update user info
    userNameEl.textContent = currentUser.fullName || currentUser.username;
    userRoleEl.textContent = getRoleName(currentUser.role);
}


// Get role name in Arabic
function getRoleName(role) {
    const roles = {
        'admin': 'مدير النظام',
        'accountant': 'محاسب',
        'secretary': 'سكرتير',
        'teacher': 'أستاذ'
    };
    return roles[role] || role;
}


// Show specific section
function showSection(sectionId) {
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    document.getElementById(`${sectionId}Section`).classList.add('active');
    
    // Load section-specific data
    switch(sectionId) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'payments':
            loadPayments();
            break;
        case 'expenses':
            loadExpenses();
            break;
        case 'reports':
            loadReports();
            break;
        case 'teachers':
            loadTeacherCommissions();
            break;
        case 'invoices':
            loadInvoices();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'expenses':
            loadExpenses();
            break;
    }
}


// Show modal
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

// Hide modal
function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}


// Show loading overlay
function showLoading() {
    loadingOverlay.style.display = 'flex';
}


// Hide loading overlay
function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// Load initial data
function loadInitialData() {
    loadDashboardData();
    populateMonths();
    populateYears();
    populateClasses();
    populateTeachers();
    populateStudents();
}

// Populate classes dropdown
async function populateClasses() {
    try {
        const response = await fetch(`${API_BASE}/classes`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const classes = await response.json();
            const classFilter = document.getElementById('paymentClassFilter');
            const paymentClass = document.getElementById('paymentClass');
            
            // Clear existing options except the first one
            while (classFilter.options.length > 1) {
                classFilter.remove(1);
            }
            while (paymentClass.options.length > 1) {
                paymentClass.remove(1);
            }
            
            // Add classes to filter and payment form
            classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls._id;
                option.textContent = cls.name;
                classFilter.appendChild(option.cloneNode(true));
                paymentClass.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading classes:', error);
    }
}



// Populate teachers dropdown
async function populateTeachers() {
    try {
        const response = await fetch(`${API_BASE}/teachers`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const teachers = await response.json();
            const teacherFilter = document.getElementById('teacherFilter');
            
            // Clear existing options except the first one
            while (teacherFilter.options.length > 1) {
                teacherFilter.remove(1);
            }
            
            // Add teachers to filter
            teachers.forEach(teacher => {
                const option = document.createElement('option');
                option.value = teacher._id;
                option.textContent = teacher.name;
                teacherFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading teachers:', error);
    }
}


async function populateStudents() {
    try {
        const response = await fetch(`${API_BASE}/students`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const students = await response.json();
            const paymentStudent = document.getElementById('paymentStudent');
            
            // Clear existing options except the first one
            while (paymentStudent.options.length > 1) {
                paymentStudent.remove(1);
            }
            
            // Add students to payment form
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student._id;
                option.textContent = student.name;
                paymentStudent.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading students:', error);
    }
}


async function loadDashboardData() {
showLoading();

try {
// تحديث الإحصائيات
await updateDashboardStats();

// تحميل المعاملات الحديثة
await loadTransactions();

// تحميل بيانات الرسم البياني
await loadChartData();

} catch (error) {
console.error('Error loading dashboard data:', error);
} finally {
hideLoading();
}
}
// Update dashboard statistics
// Update dashboard statistics
function updateDashboardStats(stats) {
document.getElementById('totalIncome').textContent = `${stats.currentMonthSummary.income.toLocaleString()} د.ج`;
document.getElementById('totalExpenses').textContent = `${stats.currentMonthSummary.expenses.toLocaleString()} د.ج`;
document.getElementById('netProfit').textContent = `${stats.currentMonthSummary.profit.toLocaleString()} د.ج`;

// Get pending payments count
fetch(`${API_BASE}/payments?status=pending`, {
headers: {
    'Authorization': `Bearer ${authToken}`
}
})
.then(response => response.json())
.then(payments => {
document.getElementById('pendingPayments').textContent = payments.length || 0;
})
.catch(error => {
console.error('Error loading pending payments:', error);
});
}


// Load transactions
async function loadTransactions() {
    try {
        const response = await fetch(`${API_BASE}/accounting/all-transactions?limit=10`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const transactions = await response.json();
            renderTransactions(transactions);
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}


// Render transactions in table
function renderTransactions(transactions) {
    const tbody = document.getElementById('recentTransactions');
    tbody.innerHTML = '';
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد معاملات</td></tr>';
        return;
    }
    
    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        
        const date = new Date(transaction.date).toLocaleDateString('ar-EG');
        const type = transaction.type === 'income' ? 'إيراد' : 'مصروف';
        const amountClass = transaction.type === 'income' ? 'text-success' : 'text-danger';
        const amountSign = transaction.type === 'income' ? '+' : '-';
        
        let statusBadge = '';
        if (transaction.status) {
            if (transaction.status === 'paid') {
                statusBadge = '<span class="badge badge-success">مدفوع</span>';
            } else if (transaction.status === 'pending') {
                statusBadge = '<span class="badge badge-warning">معلق</span>';
            } else if (transaction.status === 'late') {
                statusBadge = '<span class="badge badge-danger">متأخر</span>';
            }
        }
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${type}</td>
            <td>${transaction.description}</td>
            <td class="${amountClass}">${amountSign} ${transaction.amount.toLocaleString()} د.ج</td>
            <td>${statusBadge}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Load chart data
async function loadChartData() {
try {
const response = await fetch(`${API_BASE}/accounting/dashboard`, {
    headers: {
        'Authorization': `Bearer ${authToken}`
    }
});

if (response.ok) {
    const data = await response.json();
    renderChart(data);
}
} catch (error) {
console.error('Error loading chart data:', error);
// إنشاء بيانات افتراضية للرسم البياني في حالة الخطأ
renderChart({
    monthlyIncome: [
        { _id: 1, total: 500000 },
        { _id: 2, total: 750000 },
        { _id: 3, total: 600000 },
        { _id: 4, total: 900000 },
        { _id: 5, total: 800000 },
        { _id: 6, total: 950000 }
    ],
    monthlyExpenses: [
        { _id: 1, total: 300000 },
        { _id: 2, total: 400000 },
        { _id: 3, total: 350000 },
        { _id: 4, total: 500000 },
        { _id: 5, total: 450000 },
        { _id: 6, total: 550000 }
    ]
});
}
}

function renderChart(data) {
const ctx = document.getElementById('incomeExpenseChart').getContext('2d');

// التحقق من وجود البيانات

if (window.incomeExpenseChart && typeof window.incomeExpenseChart.destroy === 'function') {
window.incomeExpenseChart.destroy();
}

if (!data || !data.monthlyIncome || !data.monthlyExpenses) {
console.error('Invalid chart data structure:', data);
return;
}

// استخراج التسميات والبيانات من الاستجابة
const labels = data.monthlyIncome.map(item => {
const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
return `${months[item._id - 1]}`;
});

const incomeData = data.monthlyIncome.map(item => item.total);
const expenseData = data.monthlyExpenses.map(item => item.total);

// تدمير المخطط السابق إن وجد
if (window.incomeExpenseChart) {
window.incomeExpenseChart.destroy();
}

// إنشاء مخطط جديد
window.incomeExpenseChart = new Chart(ctx, {
type: 'line',
data: {
    labels: labels,
    datasets: [
        {
            label: 'الإيرادات',
            data: incomeData,
            borderColor: '#2ecc71',
            backgroundColor: 'rgba(46, 204, 113, 0.1)',
            fill: true,
            tension: 0.3
        },
        {
            label: 'المصروفات',
            data: expenseData,
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            fill: true,
            tension: 0.3
        }
    ]
},
options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        title: {
            display: true,
            text: 'الإيرادات والمصروفات الشهرية',
            font: {
                size: 16
            }
        },
        legend: {
            position: 'top',
        }
    },
    scales: {
        y: {
            beginAtZero: true,
            ticks: {
                callback: function(value) {
                    return value.toLocaleString() + ' د.ج';
                }
            }
        }
    }
}
});
}

function populateMonths() {
    const months = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    const monthSelects = document.querySelectorAll('#paymentMonthFilter, #teacherMonthFilter, #paymentMonth');
    
    monthSelects.forEach(select => {
        // Clear existing options except the first one
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Add months for the current year
        for (let i = 0; i <= currentMonth; i++) {
            const option = document.createElement('option');
            option.value = `${currentYear}-${(i + 1).toString().padStart(2, '0')}`;
            option.textContent = `${months[i]} ${currentYear}`;
            select.appendChild(option);
        }
        
        // Add months for the previous year
        const prevYear = currentYear - 1;
        for (let i = 0; i < 12; i++) {
            const option = document.createElement('option');
            option.value = `${prevYear}-${(i + 1).toString().padStart(2, '0')}`;
            option.textContent = `${months[i]} ${prevYear}`;
            select.appendChild(option);
        }
    });
}

function populateYears() {
    const yearSelect = document.getElementById('reportYear');
    const currentYear = new Date().getFullYear();
    
    // Clear existing options
    yearSelect.innerHTML = '';
    
    // Add years from current year to 5 years back
    for (let i = currentYear; i >= currentYear - 5; i--) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        if (i === currentYear) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    }
}

async function loadPayments() {
    showLoading();
    
    try {
        // Build query string from filters
        const statusFilter = document.getElementById('paymentStatusFilter').value;
        const monthFilter = document.getElementById('paymentMonthFilter').value;
        const methodFilter = document.getElementById('paymentMethodFilter').value;
        const classFilter = document.getElementById('paymentClassFilter').value;
        const studentFilter = document.getElementById('paymentStudentFilter').value;
        
        let queryParams = [
            `page=${currentPaymentsPage}`,
            `limit=${paymentsPerPage}`
        ];
        
        if (statusFilter) queryParams.push(`status=${statusFilter}`);
        if (monthFilter) queryParams.push(`month=${monthFilter}`);
        if (methodFilter) queryParams.push(`paymentMethod=${methodFilter}`);
        if (classFilter) queryParams.push(`class=${classFilter}`);
        if (studentFilter) queryParams.push(`student=${studentFilter}`);
        
        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        
        const response = await fetch(`${API_BASE}/payments${queryString}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            renderPayments(data.payments || data);
            
            // Update pagination if available
            if (data.totalPages) {
                totalPaymentsPages = data.totalPages;
                updatePaymentsPagination();
            }
        }
    } catch (error) {
        console.error('Error loading payments:', error);
    } finally {
        hideLoading();
    }
}


// Render payments in table
function renderPayments(payments) {
    const tbody = document.getElementById('paymentsTable');
    tbody.innerHTML = '';
    
    if (payments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">لا توجد مدفوعات</td></tr>';
        document.getElementById('paymentsFooter').style.display = 'none';
        return;
    }
    
    payments.forEach(payment => {
        const row = document.createElement('tr');
        
        let statusBadge = '';
        if (payment.status === 'paid') {
            statusBadge = '<span class="badge badge-success">مدفوع</span>';
        } else if (payment.status === 'pending') {
            statusBadge = '<span class="badge badge-warning">معلق</span>';
        } else if (payment.status === 'late') {
            statusBadge = '<span class="badge badge-danger">متأخر</span>';
        }
        
        const paymentDate = payment.paymentDate ? 
            new Date(payment.paymentDate).toLocaleDateString('ar-EG') : 
            '---';
        
        row.innerHTML = `
            <td>
                <input type="checkbox" data-id="${payment._id}" 
                    onchange="togglePaymentSelection('${payment._id}', this.checked)">
            </td>
            <td>${payment.student?.name || 'غير معروف'}</td>
            <td>${payment.class?.name || 'غير معروف'}</td>
            <td>${payment.month}</td>
            <td>${payment.amount.toLocaleString()} د.ج</td>
            <td>${getPaymentMethodName(payment.paymentMethod)}</td>
            <td>${statusBadge}</td>
            <td>${paymentDate}</td>
            <td class="payment-actions">
                <button class="btn btn-sm" onclick="viewPayment('${payment._id}')">عرض</button>
                ${payment.status !== 'paid' ? 
                    `<button class="btn btn-sm btn-success" onclick="markAsPaid('${payment._id}')">تسديد</button>` : 
                    ''
                }
                <button class="btn btn-sm btn-info" onclick="printReceipt('${payment._id}')">إيصال</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Show/hide footer based on whether there are payments
    document.getElementById('paymentsFooter').style.display = 'block';
    updateSelectedPaymentsCount();
}


// Toggle payment selection
function togglePaymentSelection(paymentId, isChecked) {
    if (isChecked) {
        selectedPayments.add(paymentId);
    } else {
        selectedPayments.delete(paymentId);
        document.getElementById('selectAllPayments').checked = false;
    }
    updateSelectedPaymentsCount();
}



// Update selected payments count
function updateSelectedPaymentsCount() {
    const count = selectedPayments.size;
    document.getElementById('selectedCount').textContent = `${count} مدفوعات محددة`;
}
// Clear expense filters
function clearExpenseFilters() {
document.getElementById('expenseTypeFilter').value = '';
document.getElementById('expenseCategoryFilter').value = '';
document.getElementById('expenseStartDate').value = '';
document.getElementById('expenseEndDate').value = '';
loadExpenses();
}


async function markSelectedAsPaid() {
    if (selectedPayments.size === 0) {
        alert('يرجى تحديد مدفوعات لتسديدها');
        return;
    }
    
    if (!confirm(`هل تريد بالتأكيد تسديد ${selectedPayments.size} مدفوعات؟`)) {
        return;
    }
    
    showLoading();
    
    try {
        const paymentDate = new Date().toISOString().split('T')[0];
        const paymentMethod = 'cash'; // Default method
        
        const promises = Array.from(selectedPayments).map(paymentId => 
            fetch(`${API_BASE}/payments/${paymentId}/pay`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    paymentDate,
                    paymentMethod
                })
            })
        );
        
        const results = await Promise.allSettled(promises);
        
        let successCount = 0;
        let errorCount = 0;
        
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.ok) {
                successCount++;
            } else {
                errorCount++;
            }
        });
        
        alert(`تم تسديد ${successCount} مدفوعات بنجاح. فشل ${errorCount} مدفوعات.`);
        
        // Clear selection and reload
        selectedPayments.clear();
        document.getElementById('selectAllPayments').checked = false;
        loadPayments();
        loadDashboardData(); // Refresh dashboard stats
        
    } catch (error) {
        console.error('Error marking payments as paid:', error);
        alert('حدث خطأ أثناء تسديد المدفوعات');
    } finally {
        hideLoading();
    }
}

// Update payments pagination
function updatePaymentsPagination() {
    document.getElementById('paymentsPageInfo').textContent = 
        `الصفحة ${currentPaymentsPage} من ${totalPaymentsPages}`;
}


// Change payments page
function changePaymentsPage(direction) {
    if (direction === 'next' && currentPaymentsPage < totalPaymentsPages) {
        currentPaymentsPage++;
    } else if (direction === 'prev' && currentPaymentsPage > 1) {
        currentPaymentsPage--;
    } else {
        return;
    }
    
    loadPayments();
}

// Clear payment filters
function clearPaymentFilters() {
    document.getElementById('paymentStatusFilter').value = '';
    document.getElementById('paymentMonthFilter').value = '';
    document.getElementById('paymentMethodFilter').value = '';
    document.getElementById('paymentClassFilter').value = '';
    document.getElementById('paymentStudentFilter').value = '';
    
    currentPaymentsPage = 1;
    loadPayments();
}



// Get payment method name in Arabic
function getPaymentMethodName(method) {
    const methods = {
        'cash': 'نقدي',
        'bank': 'تحويل بنكي',
        'online': 'دفع إلكتروني'
    };
    return methods[method] || method;
}

// View payment details
async function viewPayment(paymentId) {
    try {
        const response = await fetch(`${API_BASE}/payments/${paymentId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const payment = await response.json();
            // Display payment details in a modal or alert
            alert(`تفاصيل الدفعة:\nالطالب: ${payment.student.name}\nالحصة: ${payment.class.name}\nالمبلغ: ${payment.amount} د.ج\nالشهر: ${payment.month}\nالحالة: ${payment.status}`);
        }
    } catch (error) {
        console.error('Error viewing payment:', error);
        alert('حدث خطأ أثناء تحميل تفاصيل الدفعة');
    }
}



async function markAsPaid(paymentId) {
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/payments/${paymentId}/pay`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                paymentDate: new Date().toISOString(),
                paymentMethod: 'cash'
            })
        });
        
        if (response.ok) {
            alert('تم تسديد الدفعة بنجاح');
            loadPayments(); // Refresh the payments list
            loadDashboardData(); // Refresh dashboard stats
        } else {
            const error = await response.json();
            alert(`خطأ: ${error.error}`);
        }
    } catch (error) {
        console.error('Error marking payment as paid:', error);
        alert('حدث خطأ أثناء تسديد الدفعة');
    } finally {
        hideLoading();
    }
}

// Print receipt
function printReport() {
    const printContent = document.getElementById('reportsSection').innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    
    // إعادة تحميل الصفحة للحفاظ على حالة التطبيق
    location.reload();
}


// Show add payment modal
function showAddPaymentModal() {
    showModal('addPaymentModal');
}
function exportReport() {
    // يمكن استخدام مكتبة مثل jsPDF هنا
    alert('سيتم تصدير التقرير كملف PDF. هذه الميزة تحتاج إلى إعداد إضافي.');
}

// Submit payment
async function submitPayment() {
    showLoading();
    
    try {
        const studentId = document.getElementById('paymentStudent').value;
        const classId = document.getElementById('paymentClass').value;
        const month = document.getElementById('paymentMonth').value;
        const amount = document.getElementById('paymentAmount').value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        const paymentDate = document.getElementById('paymentDate').value;
        
        const response = await fetch(`${API_BASE}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                student: studentId,
                class: classId,
                month: month,
                amount: amount,
                paymentMethod: paymentMethod,
                paymentDate: paymentDate
            })
        });
        
        if (response.ok) {
            alert('تم إضافة الدفعة بنجاح');
            hideModal('addPaymentModal');
            loadPayments(); // Refresh the payments list
        } else {
            const error = await response.json();
            alert(`خطأ: ${error.error}`);
        }
    } catch (error) {
        console.error('Error adding payment:', error);
        alert('حدث خطأ أثناء إضافة الدفعة');
    } finally {
        hideLoading();
    }
}

function exportPayments() {
const statusFilter = document.getElementById('paymentStatusFilter').value;
const monthFilter = document.getElementById('paymentMonthFilter').value;
const methodFilter = document.getElementById('paymentMethodFilter').value;
const classFilter = document.getElementById('paymentClassFilter').value;

exportData('payments', 'المدفوعات', {
status: statusFilter,
month: monthFilter,
paymentMethod: methodFilter,
class: classFilter
});
}
async function paySingleCommission(commissionId) {
showLoading();

try {
const response = await fetch(`${API_BASE}/accounting/teacher-commissions/pay-single`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
        commissionId,
        paymentMethod: 'cash',
        paymentDate: new Date().toISOString().split('T')[0]
    })
});

if (response.ok) {
    const result = await response.json();
    alert(result.message);
    loadTeacherCommissions(); // إعادة تحميل قائمة العمولات
    loadDashboardData(); // تحديث لوحة التحكم
} else {
    const error = await response.json();
    alert(`خطأ: ${error.error}`);
}
} catch (error) {
console.error('Error paying commission:', error);
alert('حدث خطأ أثناء دفع العمولة');
} finally {
hideLoading();
}
}



// Print payments
function printPayments() {
    // Implementation for printing payments
    window.print();
}
async function loadExpenses() {
showLoading();

try {
const typeFilter = document.getElementById('expenseTypeFilter').value;
const categoryFilter = document.getElementById('expenseCategoryFilter').value;
const startDate = document.getElementById('expenseStartDate').value;
const endDate = document.getElementById('expenseEndDate').value;

let queryParams = [];

if (typeFilter) queryParams.push(`type=${typeFilter}`);
if (categoryFilter) queryParams.push(`category=${categoryFilter}`);
if (startDate) queryParams.push(`startDate=${startDate}`);
if (endDate) queryParams.push(`endDate=${endDate}`);

const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

const response = await fetch(`${API_BASE}/accounting/expenses${queryString}`, {
    headers: {
        'Authorization': `Bearer ${authToken}`
    }
});
if (response.ok) {
    const expenses = await response.json();
    
    // تحقق من أن البيانات هي مصفوفة
    if (Array.isArray(expenses)) {
        renderExpenses(expenses);
    } else {
        console.error('Expected array but got:', expenses);
        renderExpenses([]);
    }
} else {
    console.error('Server error:', response.status);
    renderExpenses([]);
}
} catch (error) {
console.error('Error loading expenses:', error);
renderExpenses([]);
} finally {
hideLoading();
}
}
// في جميع دوال fetch، أضف معالجة للأخطاء:
async function loadData() {
try {
const response = await fetch(url, options);

if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
}

const data = await response.json();
return data;
} catch (error) {
console.error('Fetch error:', error);
// عرض رسالة للمستخدم
showErrorToast('فشل في تحميل البيانات');
return null;
}
}
function renderTeacherCommissionsByClass(commissionsByClass) {
const container = document.getElementById('teacherCommissionsContainer');
container.innerHTML = '';

if (!commissionsByClass || commissionsByClass.length === 0) {
container.innerHTML = '<div class="text-center p-3">لا توجد عمولات</div>';
return;
}

commissionsByClass.forEach(classCommission => {
const classCard = document.createElement('div');
classCard.className = 'teacher-class-card';
classCard.style.border = '1px solid #ddd';
classCard.style.borderRadius = '5px';
classCard.style.padding = '15px';
classCard.style.marginBottom = '20px';

const pendingCommissions = classCommission.commissions.filter(c => c.status === 'pending');
const paidCommissions = classCommission.commissions.filter(c => c.status === 'paid');

const pendingAmount = pendingCommissions.reduce((sum, c) => sum + c.amount, 0);
const paidAmount = paidCommissions.reduce((sum, c) => sum + c.amount, 0);
const totalAmount = pendingAmount + paidAmount;

classCard.innerHTML = `
    <div class="teacher-class-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <div>
            <h3>${classCommission.teacher.name} - ${classCommission.class.name}</h3>
            <p>الشهر: ${classCommission.month}</p>
        </div>
        <div>
            <span class="badge badge-primary">الإجمالي: ${totalAmount.toLocaleString()} د.ج</span>
            <span class="badge badge-warning">معلقة: ${pendingAmount.toLocaleString()} د.ج</span>
            <span class="badge badge-success">مدفوعة: ${paidAmount.toLocaleString()} د.ج</span>
        </div>
    </div>
    
    <div class="commission-details">
        <h4>تفاصيل العمولات</h4>
        ${classCommission.commissions.map(commission => `
            <div class="commission-item" style="padding: 10px; border-bottom: 1px solid #eee;">
                <div style="display: flex; justify-content: space-between;">
                    <strong>${commission.student.name}</strong>
                    <span class="badge ${commission.status === 'paid' ? 'badge-success' : 'badge-warning'}">
                        ${commission.status === 'paid' ? 'مدفوع' : 'معلق'}
                    </span>
                </div>
                <div>المبلغ: ${commission.amount.toLocaleString()} د.ج</div>
                <div>النسبة: ${commission.percentage}%</div>
                ${commission.status === 'paid' ? `
                    <div class="text-muted mt-2">
                        تم الدفع في: ${new Date(commission.paymentDate).toLocaleDateString('ar-EG')}
                    </div>
                ` : ''}
            </div>
        `).join('')}
    </div>
    
    ${pendingCommissions.length > 0 ? `
        <div class="commission-summary mt-3">
            <h4>ملخص العمولات المعلقة للحصة</h4>
            ${pendingCommissions.map(commission => `
                <div class="summary-row" style="display: flex; justify-content: space-between; padding: 5px 0;">
                    <span>${commission.student.name}</span>
                    <span>${commission.amount.toLocaleString()} د.ج</span>
                </div>
            `).join('')}
            <div class="summary-row total" style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid #ddd; font-weight: bold;">
                <span>المجموع:</span>
                <span>${pendingAmount.toLocaleString()} د.ج</span>
            </div>
            <div class="action-buttons mt-3">
                <button class="btn btn-success" 
                    onclick="showPayClassCommissionModal('${classCommission.teacher._id}', '${classCommission.class._id}', '${classCommission.month}', ${pendingAmount})">
                    دفع عمولة الحصة
                </button>
                <button class="btn btn-info" 
                    onclick="exportClassCommissions('${classCommission.teacher._id}', '${classCommission.class._id}', '${classCommission.month}')">
                    تصدير التقرير
                </button>
            </div>
        </div>
    ` : ''}
`;

container.appendChild(classCard);
});
}
async function showPayClassCommissionModal(teacherId, classId, month, totalAmount) {
try {
// جلب بيانات الأستاذ والحصة
const [teacherResponse, classResponse] = await Promise.all([
    fetch(`${API_BASE}/teachers/${teacherId}`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    }),
    fetch(`${API_BASE}/classes/${classId}`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
]);

if (teacherResponse.ok && classResponse.ok) {
    const teacher = await teacherResponse.json();
    const classObj = await classResponse.json();
    
    // تعبئة بيانات المودال
    document.getElementById('commissionTeacherId').value = teacherId;
    document.getElementById('commissionClassId').value = classId;
    document.getElementById('commissionTeacherName').value = teacher.name;
    document.getElementById('commissionClassName').value = classObj.name;
    document.getElementById('commissionMonth').value = month;
    document.getElementById('commissionTotalAmount').value = totalAmount;
    document.getElementById('commissionPercentage').value = classObj.teacher?.salaryPercentage || 70;
    
    // حساب مبلغ العمولة
    calculateCommissionAmount();
    
    // تعيين تاريخ اليوم كتاريخ افتراضي للدفع
    document.getElementById('commissionPaymentDate').value = new Date().toISOString().split('T')[0];
    
    // عرض المودال
    showModal('payClassCommissionModal');
}
} catch (error) {
console.error('Error loading commission details:', error);
alert('حدث خطأ أثناء تحميل بيانات العمولة');
}
}

// دالة لحساب مبلغ العمولة بناءً على النسبة
function calculateCommissionAmount() {
const totalAmount = parseFloat(document.getElementById('commissionTotalAmount').value);
const percentage = parseFloat(document.getElementById('commissionPercentage').value);

if (!isNaN(totalAmount) && !isNaN(percentage)) {
const commissionAmount = totalAmount * (percentage / 100);
document.getElementById('commissionAmount').value = commissionAmount.toFixed(2);
}
}

async function loadTeacherCommissions() {
showLoading();

try {
const teacherFilter = document.getElementById('teacherFilter').value;
const monthFilter = document.getElementById('teacherMonthFilter').value;
const statusFilter = document.getElementById('teacherStatusFilter').value;
const classFilter = document.getElementById('teacherClassFilter').value;

let queryParams = [];
if (teacherFilter) queryParams.push(`teacher=${teacherFilter}`);
if (monthFilter) queryParams.push(`month=${monthFilter}`);
if (statusFilter) queryParams.push(`status=${statusFilter}`);
if (classFilter) queryParams.push(`class=${classFilter}`);

const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

const response = await fetch(`${API_BASE}/accounting/teacher-commissions-by-class${queryString}`, {
    headers: {
        'Authorization': `Bearer ${authToken}`
    }
});

if (response.ok) {
    const commissionsByClass = await response.json();
    renderTeacherCommissionsByClass(commissionsByClass);
}
} catch (error) {
console.error('Error loading teacher commissions:', error);
alert('حدث خطأ أثناء تحميل بيانات العمولات');
} finally {
hideLoading();
}
}
async function submitClassCommissionPayment() {
showLoading();

try {
const teacherId = document.getElementById('commissionTeacherId').value;
const classId = document.getElementById('commissionClassId').value;
const month = document.getElementById('commissionMonth').value;
const paymentMethod = document.getElementById('commissionPaymentMethod').value;
const paymentDate = document.getElementById('commissionPaymentDate').value;
const percentage = parseFloat(document.getElementById('commissionPercentage').value);

const response = await fetch(`${API_BASE}/accounting/teacher-commissions/pay-by-class`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
        teacherId,
        classId,
        month,
        paymentMethod,
        paymentDate,
        percentage
    })
});

if (response.ok) {
    const result = await response.json();
    alert(result.message);
    hideModal('payClassCommissionModal');
    loadTeacherCommissions(); // إعادة تحميل قائمة العمولات
    loadDashboardData(); // تحديث لوحة التحكم
} else {
    const error = await response.json();
    alert(`خطأ: ${error.error}`);
}
} catch (error) {
console.error('Error paying class commission:', error);
alert('حدث خطأ أثناء دفع عمولة الحصة');
} finally {
hideLoading();
}
}
async function exportClassCommissions(teacherId, classId, month) {
try {
const response = await fetch(`${API_BASE}/accounting/teacher-commissions/export?teacher=${teacherId}&class=${classId}&month=${month}`, {
    headers: {
        'Authorization': `Bearer ${authToken}`
    }
});

if (response.ok) {
    const data = await response.blob();
    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `عمولة_الحصة_${month}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}
} catch (error) {
console.error('Error exporting commissions:', error);
alert('حدث خطأ أثناء تصدير التقرير');
}
}

// دالة لمسح عوامل التصفية
function clearTeacherFilters() {
document.getElementById('teacherFilter').value = '';
document.getElementById('teacherMonthFilter').value = '';
document.getElementById('teacherStatusFilter').value = '';
document.getElementById('teacherClassFilter').value = '';

loadTeacherCommissions();
}
// Render teacher commissions
function renderTeacherCommissions(commissions) {
    const container = document.getElementById('teacherCommissionsContainer');
    container.innerHTML = '';
    
    if (!commissions || commissions.length === 0) {
        container.innerHTML = '<div class="text-center p-3">لا توجد عمولات</div>';
        return;
    }
    
    // Group commissions by teacher
    const commissionsByTeacher = {};
    commissions.forEach(commission => {
        const teacherId = commission.teacher._id;
        if (!commissionsByTeacher[teacherId]) {
            commissionsByTeacher[teacherId] = {
                teacher: commission.teacher,
                commissions: []
            };
        }
        commissionsByTeacher[teacherId].commissions.push(commission);
    });
    
    // Render each teacher's commissions
    Object.values(commissionsByTeacher).forEach(teacherData => {
        const teacher = teacherData.teacher;
        const teacherCommissions = teacherData.commissions;
        
        const teacherCard = document.createElement('div');
        teacherCard.className = 'teacher-card';
        
        // Calculate totals
        const pendingCommissions = teacherCommissions.filter(c => c.status === 'pending');
        const paidCommissions = teacherCommissions.filter(c => c.status === 'paid');
        
        const pendingAmount = pendingCommissions.reduce((sum, c) => sum + c.amount, 0);
        const paidAmount = paidCommissions.reduce((sum, c) => sum + c.amount, 0);
        const totalAmount = pendingAmount + paidAmount;
        
        teacherCard.innerHTML = `
            <div class="teacher-header">
                <h3>${teacher.name}</h3>
                <div>
                    <span class="badge badge-primary">إجمالي العمولات: ${totalAmount.toLocaleString()} د.ج</span>
                    <span class="badge badge-warning">معلقة: ${pendingAmount.toLocaleString()} د.ج</span>
                    <span class="badge badge-success">مدفوعة: ${paidAmount.toLocaleString()} د.ج</span>
                </div>
            </div>
            
            <div class="commission-details">
                ${teacherCommissions.map(commission => `
                    <div class="commission-item">
                        <div class="d-flex justify-content-between">
                            <strong>الشهر: ${commission.month}</strong>
                            <span class="badge ${commission.status === 'paid' ? 'badge-success' : 'badge-warning'}">
                                ${commission.status === 'paid' ? 'مدفوع' : 'معلق'}
                            </span>
                        </div>
                        <div>الطالب: ${commission.student?.name || 'غير معروف'}</div>
                        <div>الحصة: ${commission.class?.name || 'غير معروف'}</div>
                        <div>المبلغ: ${commission.amount.toLocaleString()} د.ج</div>
                        <div>النسبة: ${commission.percentage}%</div>
                        ${commission.status === 'pending' ? `
                            <button class="btn btn-sm btn-success mt-2" 
                                onclick="showPayCommissionModal('${commission._id}')">
                                دفع العمولة
                            </button>
                        ` : `
                            <div class="text-muted mt-2">
                                تم الدفع في: ${new Date(commission.paymentDate).toLocaleDateString('ar-EG')}
                            </div>
                        `}
                    </div>
                `).join('')}
            </div>
            
            ${pendingCommissions.length > 0 ? `
                <div class="commission-summary">
                    <h4>ملخص العمولات المعلقة</h4>
                    ${pendingCommissions.map(commission => `
                        <div class="summary-row">
                            <span>${commission.month} - ${commission.student?.name || 'غير معروف'}</span>
                            <span>${commission.amount.toLocaleString()} د.ج</span>
                        </div>
                    `).join('')}
                    <div class="summary-row total">
                        <span>المجموع:</span>
                        <span>${pendingAmount.toLocaleString()} د.ج</span>
                    </div>
                    <button class="btn btn-success mt-2" 
                        onclick="payAllTeacherCommissions('${teacher._id}')">
                        دفع جميع عمولات الأستاذ
                    </button>
                </div>
            ` : ''}
        `;
        
        container.appendChild(teacherCard);
    });
}


async function showPayCommissionModal(commissionId) {
    try {
        const response = await fetch(`${API_BASE}/accounting/teacher-commissions/${commissionId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const commission = await response.json();
            
            document.getElementById('commissionId').value = commission._id;
            document.getElementById('commissionTeacher').value = commission.teacher.name;
            document.getElementById('commissionMonth').value = commission.month;
            document.getElementById('commissionAmount').value = commission.amount;
            document.getElementById('commissionPaymentDate').value = new Date().toISOString().split('T')[0];
            
            showModal('payCommissionModal');
        }
    } catch (error) {
        console.error('Error loading commission details:', error);
        alert('حدث خطأ أثناء تحميل بيانات العمولة');
    }
}


// Submit commission payment
async function submitCommissionPayment() {
    showLoading();
    
    try {
        const commissionId = document.getElementById('commissionId').value;
        const paymentMethod = document.getElementById('commissionPaymentMethod').value;
        const paymentDate = document.getElementById('commissionPaymentDate').value;
        
        const response = await fetch(`${API_BASE}/accounting/teacher-commissions/pay`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                commissionId,
                paymentMethod,
                paymentDate
            })
        });
        
        if (response.ok) {
            alert('تم دفع العمولة بنجاح');
            hideModal('payCommissionModal');
            loadTeacherCommissions(); // Refresh the commissions list
            loadDashboardData(); // Refresh dashboard stats
        } else {
            const error = await response.json();
            alert(`خطأ: ${error.error}`);
        }
    } catch (error) {
        console.error('Error paying commission:', error);
        alert('حدث خطأ أثناء دفع العمولة');
    } finally {
        hideLoading();
    }
}


// Pay all commissions for a teacher
async function payAllTeacherCommissions(teacherId, classId) {
if (!confirm('هل تريد بالتأكيد دفع جميع عمولات هذا الأستاذ لهذه الحصة؟')) {
return;
}

showLoading();

try {
// الحصول على جميع عمولات الأستاذ للحصة المحددة
const commissions = await TeacherCommission.find({
    teacher: teacherId,
    class: classId,
    status: 'pending'
}).populate('teacher student class');

if (commissions.length === 0) {
    alert('لا توجد عمولات معلقة لهذا الأستاذ في هذه الحصة');
    hideLoading();
    return;
}

let totalAmount = 0;
const paidCommissions = [];

// دفع كل عمولة على حدة
for (const commission of commissions) {
    totalAmount += commission.amount;
    
    const response = await fetch(`${API_BASE}/accounting/teacher-commissions/pay-single`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            commissionId: commission._id,
            paymentMethod: 'cash',
            paymentDate: new Date().toISOString().split('T')[0]
        })
    });
    
    if (response.ok) {
        paidCommissions.push({
            student: commission.student.name,
            amount: commission.amount,
            month: commission.month
        });
    }
}

alert(`تم دفع ${paidCommissions.length} عمولة بإجمالي ${totalAmount.toLocaleString()} د.ج`);
loadTeacherCommissions(); // إعادة تحميل قائمة العمولات
loadDashboardData(); // تحديث لوحة التحكم

} catch (error) {
console.error('Error paying commissions:', error);
alert('حدث خطأ أثناء دفع العمولات');
} finally {
hideLoading();
}
}

// Calculate all commissions
async function calculateAllCommissions() {
    if (!confirm('هل تريد بالتأكيد حساب جميع العمولات للأساتذة؟')) {
        return;
    }
    
    showLoading();
    
    try {
        // This would typically call an API endpoint to calculate commissions
        // For now, we'll simulate the process
        
        // First, get all pending payments
        const paymentsResponse = await fetch(`${API_BASE}/payments?status=paid&commissionRecorded=false`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (paymentsResponse.ok) {
            const payments = await paymentsResponse.json();
            
            if (payments.length === 0) {
                alert('لا توجد مدفوعات جديدة تحتاج إلى حساب عمولات');
                hideLoading();
                return;
            }
            
            // For each payment, calculate and record commission
            let processedCount = 0;
            let errorCount = 0;
            
            for (const payment of payments) {
                try {
                    if (payment.class && payment.class.teacher) {
                        const commissionPercentage = payment.class.teacher.salaryPercentage || 70;
                        const commissionAmount = payment.amount * (commissionPercentage / 100);
                        
                        const commissionResponse = await fetch(`${API_BASE}/accounting/teacher-commissions`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`
                            },
                            body: JSON.stringify({
                                teacherId: payment.class.teacher._id,
                                studentId: payment.student._id,
                                classId: payment.class._id,
                                month: payment.month,
                                amount: commissionAmount,
                                percentage: commissionPercentage
                            })
                        });
                        
                        if (commissionResponse.ok) {
                            // Mark payment as having commission recorded
                            await fetch(`${API_BASE}/payments/${payment._id}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${authToken}`
                                },
                                body: JSON.stringify({
                                    commissionRecorded: true
                                })
                            });
                            
                            processedCount++;
                        } else {
                            errorCount++;
                        }
                    }
                } catch (error) {
                    console.error('Error processing payment:', error);
                    errorCount++;
                }
            }
            
            alert(`تم معالجة ${processedCount} مدفوعات بنجاح. حدثت أخطاء في ${errorCount} مدفوعات.`);
            loadTeacherCommissions(); // Refresh the commissions list
        }
    } catch (error) {
        console.error('Error calculating commissions:', error);
        alert('حدث خطأ أثناء حساب العمولات');
    } finally {
        hideLoading();
    }
}


// Pay all teachers
async function payAllTeachers() {
    if (!confirm('هل تريد بالتأكيد دفع جميع مستحقات الأساتذة؟')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/teachers/pay-all-salaries`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                paymentMethod: 'cash',
                paymentDate: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(result.message);
            loadTeacherCommissions(); // Refresh the commissions list
            loadDashboardData(); // Refresh dashboard stats
        } else {
            const error = await response.json();
            alert(`خطأ: ${error.error}`);
        }
    } catch (error) {
        console.error('Error paying all teachers:', error);
        alert('حدث خطأ أثناء دفع مستحقات الأساتذة');
    } finally {
        hideLoading();
    }
}

// Update teachers pagination
function updateTeachersPagination() {
    document.getElementById('teachersPageInfo').textContent = 
        `الصفحة ${currentTeachersPage} من ${totalTeachersPages}`;
}


// Change teachers page
function changeTeachersPage(direction) {
    if (direction === 'next' && currentTeachersPage < totalTeachersPages) {
        currentTeachersPage++;
    } else if (direction === 'prev' && currentTeachersPage > 1) {
        currentTeachersPage--;
    } else {
        return;
    }
    
    loadTeacherCommissions();
}


// Clear teacher filters
function clearTeacherFilters() {
    document.getElementById('teacherFilter').value = '';
    document.getElementById('teacherMonthFilter').value = '';
    document.getElementById('teacherStatusFilter').value = '';
    
    currentTeachersPage = 1;
    loadTeacherCommissions();
}
async function loadInvoices() {
    showLoading();
    
    try {
        const typeFilter = document.getElementById('invoiceTypeFilter').value;
        const statusFilter = document.getElementById('invoiceStatusFilter').value;
        const startDate = document.getElementById('invoiceStartDate').value;
        const endDate = document.getElementById('invoiceEndDate').value;
        
        let queryParams = [];
        
        if (typeFilter) queryParams.push(`type=${typeFilter}`);
        if (statusFilter) queryParams.push(`status=${statusFilter}`);
        if (startDate) queryParams.push(`startDate=${startDate}`);
        if (endDate) queryParams.push(`endDate=${endDate}`);
        
        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        
        const response = await fetch(`${API_BASE}/accounting/invoices${queryString}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const invoices = await response.json();
            renderInvoices(invoices);
        }
    } catch (error) {
        console.error('Error loading invoices:', error);
    } finally {
        hideLoading();
    }
}

// Render invoices
function renderInvoices(invoices) {
    const tbody = document.getElementById('invoicesTable');
    tbody.innerHTML = '';
    
    if (invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">لا توجد فواتير</td></tr>';
        return;
    }
    
    invoices.forEach(invoice => {
        const row = document.createElement('tr');
        const date = new Date(invoice.date).toLocaleDateString('ar-EG');
        
        let statusBadge = '';
        if (invoice.status === 'paid') {
            statusBadge = '<span class="badge badge-success">مدفوع</span>';
        } else if (invoice.status === 'pending') {
            statusBadge = '<span class="badge badge-warning">معلق</span>';
        } else if (invoice.status === 'overdue') {
            statusBadge = '<span class="badge badge-danger">متأخر</span>';
        }
        
        row.innerHTML = `
            <td>${invoice.invoiceNumber}</td>
            <td>${invoice.type}</td>
            <td>${invoice.recipient?.name || 'غير معروف'}</td>
            <td>${date}</td>
            <td>${invoice.totalAmount.toLocaleString()} د.ج</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewInvoice('${invoice._id}')">عرض</button>
                <button class="btn btn-sm btn-primary" onclick="printInvoice('${invoice._id}')">طباعة</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}
async function viewInvoice(invoiceId) {
    try {
        const response = await fetch(`${API_BASE}/accounting/invoices/${invoiceId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const invoice = await response.json();
            
            // Populate invoice modal
            document.getElementById('invoiceNumber').textContent = invoice.invoiceNumber;
            document.getElementById('invoiceDate').textContent = new Date(invoice.date).toLocaleDateString('ar-EG');
            document.getElementById('invoiceDueDate').textContent = new Date(invoice.dueDate).toLocaleDateString('ar-EG');
            document.getElementById('invoiceRecipientName').textContent = invoice.recipientDetails.name;
            document.getElementById('invoiceRecipientDetails').textContent = `هاتف: ${invoice.recipientDetails.phone} | بريد: ${invoice.recipientDetails.email}`;
            document.getElementById('invoiceType').textContent = invoice.type;
            document.getElementById('invoiceStatus').textContent = invoice.status;
            document.getElementById('invoiceStatus').className = `badge ${invoice.status === 'paid' ? 'badge-success' : invoice.status === 'pending' ? 'badge-warning' : 'badge-danger'}`;
            
            // Populate invoice items
            const itemsTable = document.getElementById('invoiceItems');
            itemsTable.innerHTML = '';
            
            invoice.items.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>${item.amount.toLocaleString()} د.ج</td>
                    <td>${(item.quantity * item.amount).toLocaleString()} د.ج</td>
                `;
                itemsTable.appendChild(row);
            });
            
            // Calculate totals
            const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.amount), 0);
            const tax = subtotal * (invoice.taxRate || 0) / 100;
            const total = subtotal + tax;
            
            document.getElementById('invoiceSubtotal').textContent = `${subtotal.toLocaleString()} د.ج`;
            document.getElementById('invoiceTax').textContent = `${tax.toLocaleString()} د.ج`;
            document.getElementById('invoiceTotal').textContent = `${total.toLocaleString()} د.ج`;
            
            document.getElementById('invoiceNotes').textContent = invoice.notes || 'شكراً لتعاملكم معنا';
            
            showModal('viewInvoiceModal');
        }
    } catch (error) {
        console.error('Error viewing invoice:', error);
        alert('حدث خطأ أثناء تحميل الفاتورة');
    }
}

function printInvoice(invoiceId) {
    // Implementation for printing invoice
    alert(`طباعة الفاتورة: ${invoiceId}`);
}
function showCreateInvoiceModal() {
    // Implementation for showing create invoice modal
    alert('إنشاء فاتورة جديدة');
}


// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', initApp);







        // ========== دوال جديدة لمعالجة المشاكل المذكورة ==========

// دالة لتصدير البيانات إلى Excel
async function exportToExcel(endpoint, fileName) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // تحويل البيانات إلى ورقة Excel
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
            
            // إنشاء الملف وتنزيله
            XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
            
            alert(`تم تصدير ${fileName} بنجاح`);
        } else {
            throw new Error('فشل في جلب البيانات');
        }
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('حدث خطأ أثناء التصدير: ' + error.message);
    } finally {
        hideLoading();
    }
}

// دالة لإنشاء فاتورة للطباعة
function generateInvoice(invoiceData) {
    // تعبئة بيانات الفاتورة
    document.getElementById('invoiceNumber').textContent = invoiceData.invoiceNumber || `INV-${Date.now()}`;
    document.getElementById('invoiceDate').textContent = new Date().toLocaleDateString('ar-EG');
    document.getElementById('invoiceDueDate').textContent = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('ar-EG');
    document.getElementById('invoiceRecipient').textContent = invoiceData.recipient;
    document.getElementById('invoiceDescription').textContent = invoiceData.description;
    
    // تفريغ العناصر السابقة
    const itemsList = document.getElementById('invoiceItemsList');
    itemsList.innerHTML = '';
    
    // إضافة العناصر
    let total = 0;
    invoiceData.items.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.description}</td>
            <td>${item.amount.toLocaleString()}</td>
        `;
        itemsList.appendChild(row);
        total += item.amount;
    });
    
    // تحديث الإجمالي
    document.getElementById('invoiceTotalAmount').textContent = total.toLocaleString();
    
    // عرض الفاتورة للطباعة
    const invoiceElement = document.getElementById('invoiceTemplate');
    invoiceElement.style.display = 'block';
    
    // طباعة الفاتورة
    window.print();
    
    // إخفاء الفاتورة بعد الطباعة
    setTimeout(() => {
        invoiceElement.style.display = 'none';
    }, 500);
}

// دالة لدفع مستحقات الأستاذ وطباعة الفاتورة
// دالة لدفع مستحقات الأستاذ وطباعة الفاتورة
async function payTeacherCommissionsAndPrint(teacherId, month) {
try {
showLoading();

// استخدام المسار الصحيح
const response = await fetch(`${API_BASE}/teachers/${teacherId}/pay-salary`, {
method: 'POST',
headers: {
'Content-Type': 'application/json',
'Authorization': `Bearer ${authToken}`
},
body: JSON.stringify({
month: month,
paymentMethod: 'cash',
paymentDate: new Date().toISOString().split('T')[0]
})
});

if (response.ok) {
const result = await response.json();

// جلب بيانات العمولات المدفوعة لإنشاء الفاتورة
const commissionsResponse = await fetch(`${API_BASE}/accounting/teacher-commissions?teacher=${teacherId}&month=${month}&status=paid`, {
headers: {
'Authorization': `Bearer ${authToken}`
}
});

if (commissionsResponse.ok) {
const commissions = await commissionsResponse.json();

if (commissions.length === 0) {
alert('تم الدفع ولكن لا توجد بيانات للفاتورة');
hideLoading();
return;
}

// إنشاء بيانات الفاتورة
const invoiceData = {
invoiceNumber: `TCH-${teacherId}-${month}-${Date.now()}`,
recipient: commissions[0].teacher.name,
description: `مستحقات الحصص لشهر ${month}`,
items: commissions.map(commission => ({
    description: `حصة ${commission.class.name} - الطالب ${commission.student.name}`,
    amount: commission.amount
}))
};

// إنشاء وطباعة الفاتورة
generateInvoice(invoiceData);
alert(`تم دفع ${commissions.length} مستحقات بإجمالي ${result.totalAmount.toLocaleString()} د.ج`);
}
} else {
const error = await response.json();
throw new Error(error.error || 'فشل في دفع المستحقات');
}
} catch (error) {
console.error('Error paying teacher commissions:', error);
alert('حدث خطأ أثناء دفع المستحقات: ' + error.message);
} finally {
hideLoading();
}
}        


async function paySingleCommission(commissionId) {
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE}/accounting/teacher-commissions/pay-single`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                commissionId,
                paymentMethod: 'cash',
                paymentDate: new Date().toISOString().split('T')[0]
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(result.message);
            loadTeacherCommissions(); // إعادة تحميل قائمة العمولات
            loadDashboardData(); // تحديث لوحة التحكم
        } else {
            const error = await response.json();
            alert(`خطأ: ${error.error}`);
        }
    } catch (error) {
        console.error('Error paying commission:', error);
        alert('حدث خطأ أثناء دفع العمولة');
    } finally {
        hideLoading();
    }
}
function renderTeacherCommissions(commissions) {
const container = document.getElementById('teacherCommissionsContainer');
container.innerHTML = '';

if (!commissions || commissions.length === 0) {
container.innerHTML = '<div class="text-center p-3">لا توجد عمولات</div>';
return;
}

// تجميع العمولات حسب الأستاذ والحصة
const commissionsByTeacherAndClass = {};

commissions.forEach(commission => {
const teacherId = commission.teacher._id;
const classId = commission.class._id;
const key = `${teacherId}-${classId}`;

if (!commissionsByTeacherAndClass[key]) {
    commissionsByTeacherAndClass[key] = {
        teacher: commission.teacher,
        class: commission.class,
        commissions: []
    };
}

commissionsByTeacherAndClass[key].commissions.push(commission);
});

// عرض العمولات مجمعة حسب الأستاذ والحصة
Object.values(commissionsByTeacherAndClass).forEach(group => {
const teacher = group.teacher;
const classObj = group.class;
const teacherCommissions = group.commissions;

const pendingCommissions = teacherCommissions.filter(c => c.status === 'pending');
const paidCommissions = teacherCommissions.filter(c => c.status === 'paid');

const pendingAmount = pendingCommissions.reduce((sum, c) => sum + c.amount, 0);
const paidAmount = paidCommissions.reduce((sum, c) => sum + c.amount, 0);
const totalAmount = pendingAmount + paidAmount;

const groupCard = document.createElement('div');
groupCard.className = 'teacher-card';
groupCard.style.border = '1px solid #ddd';
groupCard.style.borderRadius = '5px';
groupCard.style.padding = '15px';
groupCard.style.marginBottom = '20px';

groupCard.innerHTML = `
    <div class="teacher-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3>${teacher.name} - ${classObj.name}</h3>
        <div>
            <span class="badge badge-primary">الإجمالي: ${totalAmount.toLocaleString()} د.ج</span>
            <span class="badge badge-warning">معلقة: ${pendingAmount.toLocaleString()} د.ج</span>
            <span class="badge badge-success">مدفوعة: ${paidAmount.toLocaleString()} د.ج</span>
        </div>
    </div>
    
    <div class="commission-details">
        <h4>تفاصيل العمولات</h4>
        ${teacherCommissions.map(commission => `
            <div class="commission-item" style="padding: 10px; border-bottom: 1px solid #eee;">
                <div style="display: flex; justify-content: space-between;">
                    <strong>${commission.student?.name || 'غير معروف'} - ${commission.month}</strong>
                    <span class="badge ${commission.status === 'paid' ? 'badge-success' : 'badge-warning'}">
                        ${commission.status === 'paid' ? 'مدفوع' : 'معلق'}
                    </span>
                </div>
                <div>المبلغ: ${commission.amount.toLocaleString()} د.ج</div>
                <div>النسبة: ${commission.percentage}%</div>
                ${commission.status === 'pending' ? `
                    <button class="btn btn-sm btn-success mt-2" 
                        onclick="paySingleCommission('${commission._id}')">
                        دفع هذه العمولة
                    </button>
                ` : `
                    <div class="text-muted mt-2">
                        تم الدفع في: ${new Date(commission.paymentDate).toLocaleDateString('ar-EG')}
                    </div>
                `}
            </div>
        `).join('')}
    </div>
    
    ${pendingCommissions.length > 0 ? `
        <div class="commission-summary">
            <h4>ملخص العمولات المعلقة</h4>
            ${pendingCommissions.map(commission => `
                <div class="summary-row">
                    <span>${commission.month} - ${commission.student?.name || 'غير معروف'}</span>
                    <span>${commission.amount.toLocaleString()} د.ج</span>
                </div>
            `).join('')}
            <div class="summary-row total">
                <span>المجموع:</span>
                <span>${pendingAmount.toLocaleString()} د.ج</span>
            </div>
            <button class="btn btn-success mt-2" 
                onclick="payAllTeacherCommissions('${teacher._id}', '${classObj._id}')">
                دفع جميع عمولات هذه الحصة
            </button>
        </div>
    ` : ''}
`;

container.appendChild(groupCard);
});
}

async function exportData(endpoint, fileName, filters = {}) {
try {
showLoading();

// بناء query string من الفلاتر
const queryParams = [];
for (const key in filters) {
    if (filters[key]) {
        queryParams.push(`${key}=${encodeURIComponent(filters[key])}`);
    }
}

const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

const response = await fetch(`${API_BASE}/${endpoint}${queryString}`, {
    headers: {
        'Authorization': `Bearer ${authToken}`
    }
});

if (response.ok) {
    const data = await response.json();
    
    // تحويل البيانات إلى تنسيق Excel
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "البيانات");
    
    // إنشاء الملف وتنزيله
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    alert(`تم تصدير ${fileName} بنجاح`);
} else {
    throw new Error('فشل في جلب البيانات');
}
} catch (error) {
console.error('Error exporting data:', error);
alert('حدث خطأ أثناء التصدير: ' + error.message);
} finally {
hideLoading();
}
}


// دالة لإضافة مصروف جديد
async function addNewExpense(expenseData) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/accounting/expenses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(expenseData)
        });
        
        if (response.ok) {
            const newExpense = await response.json();
            alert('تم إضافة المصروف بنجاح');
            loadExpenses(); // إعادة تحميل قائمة المصروفات
            return newExpense;
        } else {
            const error = await response.json();
            throw new Error(error.error || 'فشل في إضافة المصروف');
        }
    } catch (error) {
        console.error('Error adding expense:', error);
        alert('حدث خطأ أثناء إضافة المصروف: ' + error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// دالة لتصدير المصروفات
function exportExpenses() {
const typeFilter = document.getElementById('expenseTypeFilter').value;
const categoryFilter = document.getElementById('expenseCategoryFilter').value;
const startDate = document.getElementById('expenseStartDate').value;
const endDate = document.getElementById('expenseEndDate').value;

exportData('accounting/expenses', 'المصروفات', {
type: typeFilter,
category: categoryFilter,
startDate: startDate,
endDate: endDate
});
}

// دالة لتصدير المدفوعات


// دالة لتصدير الفواتير
function exportInvoices() {
    const typeFilter = document.getElementById('invoiceTypeFilter').value;
    const statusFilter = document.getElementById('invoiceStatusFilter').value;
    const startDate = document.getElementById('invoiceStartDate').value;
    const endDate = document.getElementById('invoiceEndDate').value;
    
    exportData('accounting/invoices', 'الفواتير', {
        type: typeFilter,
        status: statusFilter,
        startDate: startDate,
        endDate: endDate
    });
}






async function loadReports() {
    // Implementation for loading reports
}

async function generateReport() {
    showLoading();
    
    try {
        const year = document.getElementById('reportYear').value;
        const month = document.getElementById('reportMonth').value;
        const type = document.getElementById('reportType').value;
        
        let endpoint = '';
        let params = [];
        
        if (year) params.push(`year=${year}`);
        if (month) params.push(`month=${month}`);
        
        const queryString = params.length > 0 ? `?${params.join('&')}` : '';
        
        switch (type) {
            case 'financial':
                endpoint = `${API_BASE}/accounting/reports/financial${queryString}`;
                break;
            case 'income':
                endpoint = `${API_BASE}/accounting/reports/summary${queryString}`;
                break;
            case 'expense':
                endpoint = `${API_BASE}/accounting/expense-report${queryString}`;
                break;
            case 'teacher':
                endpoint = `${API_BASE}/accounting/reports/teacher-payments${queryString}`;
                break;
        }
        
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const report = await response.json();
            renderReport(report, type);
            
            // تمكين أزرار الطباعة والتصدير
            document.querySelectorAll('.report-actions button').forEach(btn => {
                btn.disabled = false;
            });
        } else {
            throw new Error('فشل في إنشاء التقرير');
        }
    } catch (error) {
        console.error('Error generating report:', error);
        alert('حدث خطأ أثناء إنشاء التقرير: ' + error.message);
    } finally {
        hideLoading();
    }
}



function renderReport(report, type) {
    const tbody = document.getElementById('reportTable');
    tbody.innerHTML = '';
    
    if (type === 'financial') {
        // عرض التقرير المالي
        report.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.type} - ${item.category}</td>
                <td>${item.totalAmount.toLocaleString()} د.ج</td>
                <td>${((item.totalAmount / report.reduce((sum, i) => sum + i.totalAmount, 0)) * 100).toFixed(2)}%</td>
            `;
            tbody.appendChild(row);
        });
    } else if (type === 'income') {
        // عرض تقرير الإيرادات
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>الإيرادات</td>
            <td>${report.income.toLocaleString()} د.ج</td>
            <td>100%</td>
        `;
        tbody.appendChild(row);
    } else if (type === 'expense') {
        // عرض تقرير المصروفات
        report.expenses.forEach(expense => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${expense._id}</td>
                <td>${expense.total.toLocaleString()} د.ج</td>
                <td>${((expense.total / report.totalExpenses) * 100).toFixed(2)}%</td>
            `;
            tbody.appendChild(row);
        });
    } else if (type === 'teacher') {
        // عرض تقرير مدفوعات الأساتذة
        report.forEach(payment => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${payment._id}</td>
                <td>${payment.totalAmount.toLocaleString()} د.ج</td>
                <td>${((payment.totalAmount / report.reduce((sum, p) => sum + p.totalAmount, 0)) * 100).toFixed(2)}%</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    // عرض الرسم البياني
    renderReportChart(report, type);
}

function renderReportChart(report, type) {
    const ctx = document.getElementById('financialReportChart').getContext('2d');
    
    let labels = [];
    let data = [];
    
    if (type === 'financial') {
        labels = report.map(item => `${item.type} - ${item.category}`);
        data = report.map(item => item.totalAmount);
    } else if (type === 'income') {
        labels = ['الإيرادات'];
        data = [report.income];
    } else if (type === 'expense') {
        labels = report.expenses.map(expense => expense._id);
        data = report.expenses.map(expense => expense.total);
    } else if (type === 'teacher') {
        labels = report.map(payment => payment._id);
        data = report.map(payment => payment.totalAmount);
    }
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'المبلغ (د.ج)',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'التقرير المالي',
                    font: {
                        size: 16
                    }
                },
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString() + ' د.ج';
                        }
                    }
                }
            }
        }
    });
}


// ========== تعديل الدوال الحالية لإضافة الوظائف الجديدة ==========

// تعديل دالة تحميل عمولات الأساتذة لإضافة زر الدفع والطباعة
function renderTeacherCommissions(commissions) {
    const container = document.getElementById('teacherCommissionsContainer');
    container.innerHTML = '';
    
    if (!commissions || commissions.length === 0) {
        container.innerHTML = '<div class="text-center p-3">لا توجد عمولات</div>';
        return;
    }
    
    // تجميع العمولات حسب الأستاذ والشهر
    const commissionsByTeacherAndMonth = {};
    
    commissions.forEach(commission => {
        const teacherId = commission.teacher._id;
        const month = commission.month;
        const key = `${teacherId}-${month}`;
        
        if (!commissionsByTeacherAndMonth[key]) {
            commissionsByTeacherAndMonth[key] = {
                teacher: commission.teacher,
                month: month,
                commissions: []
            };
        }
        
        commissionsByTeacherAndMonth[key].commissions.push(commission);
    });
    
    // عرض العمولات مجمعة حسب الأستاذ والشهر
    Object.values(commissionsByTeacherAndMonth).forEach(group => {
        const teacher = group.teacher;
        const month = group.month;
        const teacherCommissions = group.commissions;
        
        const pendingCommissions = teacherCommissions.filter(c => c.status === 'pending');
        const paidCommissions = teacherCommissions.filter(c => c.status === 'paid');
        
        const pendingAmount = pendingCommissions.reduce((sum, c) => sum + c.amount, 0);
        const paidAmount = paidCommissions.reduce((sum, c) => sum + c.amount, 0);
        const totalAmount = pendingAmount + paidAmount;
        
        const groupCard = document.createElement('div');
        groupCard.className = 'teacher-card';
        groupCard.style.border = '1px solid #ddd';
        groupCard.style.borderRadius = '5px';
        groupCard.style.padding = '15px';
        groupCard.style.marginBottom = '20px';
        
        groupCard.innerHTML = `
            <div class="teacher-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3>${teacher.name} - ${month}</h3>
                <div>
                    <span class="badge badge-primary">الإجمالي: ${totalAmount.toLocaleString()} د.ج</span>
                    <span class="badge badge-warning">معلقة: ${pendingAmount.toLocaleString()} د.ج</span>
                    <span class="badge badge-success">مدفوعة: ${paidAmount.toLocaleString()} د.ج</span>
                </div>
            </div>
            
            ${pendingCommissions.length > 0 ? `
                <div class="action-buttons" style="margin-bottom: 15px;">
                    <button class="btn btn-success" onclick="payTeacherCommissionsAndPrint('${teacher._id}', '${month}')">
                        دفع وطباعة الفاتورة
                    </button>
                </div>
            ` : ''}
            
            <div class="commission-details">
                <h4>تفاصيل العمولات</h4>
                ${teacherCommissions.map(commission => `
                    <div class="commission-item" style="padding: 10px; border-bottom: 1px solid #eee;">
                        <div style="display: flex; justify-content: space-between;">
                            <strong>${commission.student?.name || 'غير معروف'}</strong>
                            <span class="badge ${commission.status === 'paid' ? 'badge-success' : 'badge-warning'}">
                                ${commission.status === 'paid' ? 'مدفوع' : 'معلق'}
                            </span>
                        </div>
                        <div>الحصة: ${commission.class?.name || 'غير معروف'}</div>
                        <div>المبلغ: ${commission.amount.toLocaleString()} د.ج</div>
                        <div>النسبة: ${commission.percentage}%</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.appendChild(groupCard);
    });
}

// تعديل دالة تحميل المصروفات لإضافة زر الإضافة
function renderExpenses(expenses) {
const tbody = document.getElementById('expensesTable');
tbody.innerHTML = '';

if (expenses.length === 0) {
tbody.innerHTML = '<tr><td colspan="7" class="text-center">لا توجد مصروفات</td></tr>';
return;
}

expenses.forEach(expense => {
const row = document.createElement('tr');
const date = new Date(expense.date).toLocaleDateString('ar-EG');

row.innerHTML = `
    <td>${date}</td>
    <td>${expense.description}</td>
    <td>${expense.category}</td>
    <td>${expense.recipient?.name || 'غير محدد'}</td>
    <td>${expense.amount.toLocaleString()} د.ج</td>
    <td>${getPaymentMethodName(expense.paymentMethod)}</td>
    <td>
        <button class="btn btn-sm btn-info" onclick="viewExpense('${expense._id}')">عرض</button>
        <button class="btn btn-sm btn-danger" onclick="deleteExpense('${expense._id}')">حذف</button>
    </td>
`;

tbody.appendChild(row);
});
}
async function viewExpense(expenseId) {
try {
const response = await fetch(`${API_BASE}/accounting/expenses/${expenseId}`, {
    headers: {
        'Authorization': `Bearer ${authToken}`
    }
});

if (response.ok) {
    const expense = await response.json();
    alert(`تفاصيل المصروف:\nالوصف: ${expense.description}\nالمبلغ: ${expense.amount} د.ج\nالتصنيف: ${expense.category}\nالنوع: ${expense.type}\nالتاريخ: ${new Date(expense.date).toLocaleDateString('ar-EG')}`);
}
} catch (error) {
console.error('Error viewing expense:', error);
alert('حدث خطأ أثناء تحميل تفاصيل المصروف');
}
}

async function deleteExpense(expenseId) {
if (!confirm('هل تريد بالتأكيد حذف هذا المصروف؟')) {
return;
}

showLoading();

try {
const response = await fetch(`${API_BASE}/accounting/expenses/${expenseId}`, {
    method: 'DELETE',
    headers: {
        'Authorization': `Bearer ${authToken}`
    }
});

if (response.ok) {
    alert('تم حذف المصروف بنجاح');
    loadExpenses(); // Refresh the expenses list
    loadDashboardData(); // Refresh dashboard stats
} else {
    const error = await response.json();
    alert(`خطأ: ${error.error}`);
}
} catch (error) {
console.error('Error deleting expense:', error);
alert('حدث خطأ أثناء حذف المصروف');
} finally {
hideLoading();
}
}


// دالة لعرض modal إضافة مصروف
function showAddExpenseModal() {
// Set today's date as default
document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
showModal('addExpenseModal');
}

async function submitExpense() {
showLoading();

try {
const description = document.getElementById('expenseDescription').value;
const amount = parseFloat(document.getElementById('expenseAmount').value);
const category = document.getElementById('expenseCategory').value;
const type = document.getElementById('expenseType').value;
const paymentMethod = document.getElementById('expensePaymentMethod').value;
const date = document.getElementById('expenseDate').value;

const response = await fetch(`${API_BASE}/accounting/expenses`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
        description,
        amount,
        category,
        type,
        paymentMethod,
        date
    })
});

if (response.ok) {
    alert('تم إضافة المصروف بنجاح');
    hideModal('addExpenseModal');
    loadExpenses(); // Refresh the expenses list
    loadDashboardData(); // Refresh dashboard stats
} else {
    const error = await response.json();
    alert(`خطأ: ${error.error}`);
}
} catch (error) {
console.error('Error adding expense:', error);
alert('حدث خطأ أثناء إضافة المصروف');
} finally {
hideLoading();
}
}

// تعديل دالة تحميل الإعدادات لربط زر الحفظ
function loadSettings() {
    // Load settings from localStorage or server
    const settings = JSON.parse(localStorage.getItem('accountingSettings')) || {};
    
    document.getElementById('schoolName').value = settings.schoolName || 'المؤسسة التعليمية';
    document.getElementById('currency').value = settings.currency || 'DZD';
    document.getElementById('taxRate').value = settings.taxRate || 0;
    document.getElementById('invoicePrefix').value = settings.invoicePrefix || 'INV';
    document.getElementById('paymentTerms').value = settings.paymentTerms || 30;
    document.getElementById('lateFee').value = settings.lateFee || 5;
    document.getElementById('schoolAddress').value = settings.schoolAddress || 'العنوان: الجزائر';
    document.getElementById('schoolContact').value = settings.schoolContact || 'هاتف: 0000000000\nبريد إلكتروني: info@school.com';
}


// دالة لحفظ الإعدادات
function saveSettings() {
    const settings = {
        schoolName: document.getElementById('schoolName').value,
        currency: document.getElementById('currency').value,
        taxRate: document.getElementById('taxRate').value,
        invoicePrefix: document.getElementById('invoicePrefix').value,
        paymentTerms: document.getElementById('paymentTerms').value,
        lateFee: document.getElementById('lateFee').value,
        schoolAddress: document.getElementById('schoolAddress').value,
        schoolContact: document.getElementById('schoolContact').value
    };
    
    localStorage.setItem('accountingSettings', JSON.stringify(settings));
    alert('تم حفظ الإعدادات بنجاح');
}


function initializeSettings() {
    loadSettings();
}
// ========== تهيئة الأحداث عند تحميل الصفحة ==========
document.addEventListener('DOMContentLoaded', function() {
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');

if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('active');
    });
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', function(event) {
    if (window.innerWidth < 992 && 
        sidebar.classList.contains('active') && 
        !sidebar.contains(event.target) && 
        !menuToggle.contains(event.target)) {
        sidebar.classList.remove('active');
    }
});

// Initialize the app
initApp();
});



// تحميل بيانات الميزانية
async function loadBudgets() {
try {
const response = await fetch(`${API_BASE}/accounting/budgets`, {
headers: {
'Authorization': `Bearer ${authToken}`
}
});

if (response.ok) {
const budgets = await response.json();
renderBudgets(budgets);
}
} catch (error) {
console.error('Error loading budgets:', error);
}
}

// إنشاء ميزانية جديدة
async function createBudget(budgetData) {
try {
const response = await fetch(`${API_BASE}/accounting/budgets`, {
method: 'POST',
headers: {
'Content-Type': 'application/json',
'Authorization': `Bearer ${authToken}`
},
body: JSON.stringify(budgetData)
});

if (response.ok) {
const newBudget = await response.json();
alert('تم إنشاء الميزانية بنجاح');
loadBudgets();
return newBudget;
} else {
const error = await response.json();
throw new Error(error.error);
}
} catch (error) {
console.error('Error creating budget:', error);
alert('حدث خطأ أثناء إنشاء الميزانية: ' + error.message);
throw error;
}
}
async function updateDashboardStats() {
try {
// جلب الإيرادات (مدفوعات الطلاب)
const paymentsResponse = await fetch(`${API_BASE}/payments?status=paid`, {
headers: {
    'Authorization': `Bearer ${authToken}`
}
});

// جلب المصروفات
const expensesResponse = await fetch(`${API_BASE}/accounting/expenses?status=paid`, {
headers: {
    'Authorization': `Bearer ${authToken}`
}
});

let totalIncome = 0;
let totalExpenses = 0;

if (paymentsResponse.ok) {
const payments = await paymentsResponse.json();
totalIncome = payments.reduce((sum, payment) => sum + payment.amount, 0);
}

if (expensesResponse.ok) {
const expenses = await expensesResponse.json();
totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

const netProfit = totalIncome - totalExpenses;

// تحديث واجهة المستخدم
document.getElementById('totalIncome').textContent = `${totalIncome.toLocaleString()} د.ج`;
document.getElementById('totalExpenses').textContent = `${totalExpenses.toLocaleString()} د.ج`;
document.getElementById('netProfit').textContent = `${netProfit.toLocaleString()} د.ج`;

// جلب عدد المدفوعات المعلقة
const pendingResponse = await fetch(`${API_BASE}/payments?status=pending`, {
headers: {
    'Authorization': `Bearer ${authToken}`
}
});

if (pendingResponse.ok) {
const pendingPayments = await pendingResponse.json();
document.getElementById('pendingPayments').textContent = pendingPayments.length || 0;
}

} catch (error) {
console.error('Error updating dashboard stats:', error);
}
}

// توليد تقرير الميزانية
async function generateBudgetReport() {
try {
const startDate = document.getElementById('reportStartDate').value;
const endDate = document.getElementById('reportEndDate').value;

const response = await fetch(`${API_BASE}/accounting/budget-report?startDate=${startDate}&endDate=${endDate}`, {
headers: {
'Authorization': `Bearer ${authToken}`
}
});

if (response.ok) {
const report = await response.json();
renderBudgetReport(report);
}
} catch (error) {
console.error('Error generating budget report:', error);
alert('حدث خطأ أثناء توليد التقرير');
}
}

