
// admin.js
document.addEventListener('DOMContentLoaded', function() {
    // Check if admin is already logged in
    const authToken = localStorage.getItem('adminAuthToken');
    
    if (!authToken) {
        showLoginModal();
    } else {
        verifyAdminToken(authToken);
    }
    
    // DOM Elements
    const loginModal = document.getElementById('login-modal');
    const closeModal = document.querySelector('.close-modal');
    const adminLoginForm = document.getElementById('admin-login-form');
    const logoutBtn = document.getElementById('logout');
    const userSearch = document.getElementById('user-search');
    const usersTableBody = document.getElementById('users-table-body');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    const totalUsersEl = document.getElementById('total-users');
    const activeTodayEl = document.getElementById('active-today');
    const newWeekEl = document.getElementById('new-week');
    
    // Pagination variables
    let currentPage = 1;
    const usersPerPage = 10;
    let totalUsers = 0;
    let allUsers = [];
    let filteredUsers = [];
    
    // Event listeners
    closeModal.addEventListener('click', () => {
        loginModal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
        }
    });
    
    adminLoginForm.addEventListener('submit', handleAdminLogin);
    logoutBtn.addEventListener('click', handleLogout);
    userSearch.addEventListener('input', handleUserSearch);
    prevPageBtn.addEventListener('click', goToPrevPage);
    nextPageBtn.addEventListener('click', goToNextPage);
    
    // Functions
    function showLoginModal() {
        loginModal.style.display = 'flex';
    }
    
    async function verifyAdminToken(token) {
        try {
            const response = await fetch('/verify-admin-token', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Invalid token');
            }
            
            // Token is valid, load users
            loadUsers();
        } catch (error) {
            console.error('Token verification failed:', error);
            localStorage.removeItem('adminAuthToken');
            showLoginModal();
        }
    }
    
    async function handleAdminLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        
        try {
            const response = await fetch('/admin-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('adminAuthToken', data.token);
                loginModal.style.display = 'none';
                loadUsers();
            } else {
                alert(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Network error. Please try again.');
        }
    }
    
    function handleLogout() {
        localStorage.removeItem('adminAuthToken');
        window.location.reload();
    }
    
    async function loadUsers() {
        try {
            const token = localStorage.getItem('adminAuthToken');
            const response = await fetch('/get-users', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                allUsers = data.users;
                filteredUsers = [...allUsers];
                totalUsers = allUsers.length;
                
                updateStats();
                renderUsers();
                updatePagination();
            } else {
                throw new Error(data.message || 'Failed to load users');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            alert('Failed to load users. Please try again.');
        }
    }
    
    function updateStats() {
        totalUsersEl.textContent = totalUsers;
        
        // Calculate active today (mock data)
        const activeToday = allUsers.filter(user => {
            const lastLogin = new Date(user.lastLogin);
            const today = new Date();
            return lastLogin.toDateString() === today.toDateString();
        }).length;
        
        activeTodayEl.textContent = activeToday;
        
        // Calculate new this week (mock data)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const newThisWeek = allUsers.filter(user => {
            const registered = new Date(user.registered);
            return registered >= oneWeekAgo;
        }).length;
        
        newWeekEl.textContent = newThisWeek;
    }
    
    function handleUserSearch() {
        const searchTerm = userSearch.value.toLowerCase();
        
        if (searchTerm.trim() === '') {
            filteredUsers = [...allUsers];
        } else {
            filteredUsers = allUsers.filter(user => 
                user.email.toLowerCase().includes(searchTerm) || 
                user._id.toLowerCase().includes(searchTerm)
            );
        }
        
        currentPage = 1;
        renderUsers();
        updatePagination();
    }
    
    function renderUsers() {
        usersTableBody.innerHTML = '';
        
        const startIndex = (currentPage - 1) * usersPerPage;
        const endIndex = Math.min(startIndex + usersPerPage, filteredUsers.length);
        const usersToDisplay = filteredUsers.slice(startIndex, endIndex);
        
        if (usersToDisplay.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="6" class="no-users">No users found</td>`;
            usersTableBody.appendChild(row);
            return;
        }
        
        usersToDisplay.forEach(user => {
            const row = document.createElement('tr');
            
            // Format dates
            const registeredDate = new Date(user.registered).toLocaleDateString();
            const lastLoginDate = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never';
            
            // Status badge
            const statusClass = user.isActive ? 'status-active' : 'status-inactive';
            const statusText = user.isActive ? 'Active' : 'Inactive';
            
            row.innerHTML = `
                <td>${user._id.substring(0, 8)}</td>
                <td>${user.email}</td>
                <td>${registeredDate}</td>
                <td>${lastLoginDate}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn-action view-user" data-id="${user._id}"><i class="fas fa-eye"></i></button>
                    <button class="btn-action delete-user" data-id="${user._id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
            
            usersTableBody.appendChild(row);
        });
        
        // Add event listeners to action buttons
        document.querySelectorAll('.view-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.currentTarget.getAttribute('data-id');
                viewUserDetails(userId);
            });
        });
        
        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.currentTarget.getAttribute('data-id');
                deleteUser(userId);
            });
        });
    }
    
    function updatePagination() {
        const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
        
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }
    
    function goToPrevPage() {
        if (currentPage > 1) {
            currentPage--;
            renderUsers();
            updatePagination();
        }
    }
    
    function goToNextPage() {
        const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
        
        if (currentPage < totalPages) {
            currentPage++;
            renderUsers();
            updatePagination();
        }
    }
    
    async function viewUserDetails(userId) {
        try {
            const token = localStorage.getItem('adminAuthToken');
            const response = await fetch(`/get-user/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // In a real app, you would show a modal with detailed user info
                alert(`User Details:\n\nID: ${data.user._id}\nEmail: ${data.user.email}\nRegistered: ${new Date(data.user.registered).toLocaleString()}\nLast Login: ${data.user.lastLogin ? new Date(data.user.lastLogin).toLocaleString() : 'Never'}`);
            } else {
                throw new Error(data.message || 'Failed to fetch user details');
            }
        } catch (error) {
            console.error('Error viewing user:', error);
            alert('Failed to load user details. Please try again.');
        }
    }
    
    async function deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user?')) {
            return;
        }
        
        try {
            const token = localStorage.getItem('adminAuthToken');
            const response = await fetch(`/delete-user/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert('User deleted successfully');
                loadUsers(); // Refresh the user list
            } else {
                throw new Error(data.message || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user. Please try again.');
        }
    }
});
