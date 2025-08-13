import { db, auth, authPromise } from './config.js';
import { 
  ref, get, set, update, remove, 
  onValue, query, orderByChild
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// DOM Elements
const usersTableBody = document.getElementById('usersTableBody');
const userSearchInput = document.getElementById('userSearchInput');
const roleFilter = document.getElementById('roleFilter');
const statusFilter = document.getElementById('statusFilter');
const addUserBtn = document.getElementById('addUserBtn');
const userModal = document.getElementById('userModal');
const userForm = document.getElementById('userForm');
const userIdInput = document.getElementById('userIdInput');
const fullNameInput = document.getElementById('fullNameInput');
const passwordInput = document.getElementById('passwordInput');
const positionSelect = document.getElementById('positionSelect');
const shiftSelect = document.getElementById('shiftSelect');
const statusActive = document.getElementById('statusActive');
const statusInactive = document.getElementById('statusInactive');
const userModalTitle = document.getElementById('userModalTitle');
const saveUserBtn = document.getElementById('saveUserBtn');
const cancelUserBtn = document.getElementById('cancelUserBtn');
const closeUserModal = document.getElementById('closeUserModal');
const confirmModal = document.getElementById('confirmModal');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalMessage = document.getElementById('confirmModalMessage');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
const okConfirmBtn = document.getElementById('okConfirmBtn');
const logoutModal = document.getElementById('logoutModal');
const headerLogoutBtn = document.getElementById('headerLogoutBtn');
const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
const notification = document.getElementById('notification');
const userFullName = document.getElementById('userFullName');
const userShift = document.getElementById('userShift');
const userAvatar = document.getElementById('userAvatar');

// Global variables
let users = [];
let editingUserId = null;
let userToDelete = null;

// Wait for Firebase authentication to be ready
authPromise.then(() => {
  // Initialize the user management page
  initUserManagement();
  
  // Populate user info in header
  populateUserInfoInHeader();
}).catch(error => {
  console.error("Authentication error:", error);
  showNotification("Authentication failed. Please refresh and try again.", "error");
});

function initUserManagement() {
  // Load users from database
  loadUsers();
  
  // Set up event listeners
  setupEventListeners();
}

function loadUsers() {
  const usersRef = ref(db, 'users');
  
  // Show loading indicator
  usersTableBody.innerHTML = '<tr><td colspan="8" class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Loading user data...</td></tr>';
  
  // Get users from Firebase
  onValue(usersRef, (snapshot) => {
    // Clear loading indicator
    usersTableBody.innerHTML = '';
    
    if (snapshot.exists()) {
      users = [];
      
      snapshot.forEach((childSnapshot) => {
        const userId = childSnapshot.key;
        const userData = childSnapshot.val();
        
        // Add the user ID to the user data
        userData.id = userId;
        users.push(userData);
      });
      
      // Sort users by ID
      users.sort((a, b) => (a.id?.localeCompare(b.id) || 0));
      
      // Display users
      displayUsers();
    } else {
      usersTableBody.innerHTML = '<tr><td colspan="8" class="empty-state">No users found in the database.</td></tr>';
    }
  }, (error) => {
    console.error("Error loading users:", error);
    usersTableBody.innerHTML = '<tr><td colspan="8" class="error-state">Error loading user data. Please try again.</td></tr>';
    showNotification("Failed to load user data.", "error");
  });
}

function displayUsers() {
  // Clear the table
  usersTableBody.innerHTML = '';
  
  // Apply filters
  const searchTerm = userSearchInput.value.toLowerCase();
  const roleValue = roleFilter.value;
  const statusValue = statusFilter.value;
  
  // Filter users
  const filteredUsers = users.filter(user => {
    // Search filter
    const nameMatch = user.Name?.toLowerCase().includes(searchTerm) || false;
    const idMatch = user.id?.toLowerCase().includes(searchTerm) || false;
    const searchMatch = nameMatch || idMatch;
    
    // Position filter
    const roleMatch = roleValue === '' || user.Position === roleValue;
    
    // Status filter - assume all users are active unless specified
    const userStatus = user.status || 'active';
    const statusMatch = statusValue === '' || userStatus === statusValue;
    
    return searchMatch && roleMatch && statusMatch;
  });
  
  // Display users or show empty message
  if (filteredUsers.length === 0) {
    usersTableBody.innerHTML = '<tr><td colspan="8" class="empty-state">No users match your search criteria.</td></tr>';
    return;
  }
  
  // Display each user
  filteredUsers.forEach((user, index) => {
    const row = document.createElement('tr');
    
    // Format the last login date
    let lastLoginText = 'Never';
    if (user.lastLogin) {
      const lastLogin = new Date(user.lastLogin);
      lastLoginText = `${lastLogin.toLocaleDateString()} ${lastLogin.toLocaleTimeString()}`;
    }
    
    // Determine status
    const status = user.status || 'inactive';
    
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${user.id || ''}</td>
      <td>${user.Name || ''}</td>
      <td>${user.Position || ''}</td>
      <td><span class="shift-badge shift-${user.Shift?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}">${user.Shift || 'Unknown'}</span></td>
      <td><span class="status-badge status-${status}">${status.toUpperCase()}</span></td>
      <td>${lastLoginText}</td>
      <td class="table-actions">
        <button class="btn btn-edit edit-user" data-id="${user.id}">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn btn-delete delete-user" data-id="${user.id}">
          <i class="fas fa-trash"></i> Delete
        </button>
      </td>
    `;
    
    usersTableBody.appendChild(row);
  });
  
  // Add event listeners to action buttons
  document.querySelectorAll('.edit-user').forEach(button => {
    button.addEventListener('click', () => {
      const userId = button.getAttribute('data-id');
      openEditUserModal(userId);
    });
  });
  
  document.querySelectorAll('.delete-user').forEach(button => {
    button.addEventListener('click', () => {
      const userId = button.getAttribute('data-id');
      openDeleteConfirmation(userId);
    });
  });
}

function setupEventListeners() {
  // Search and filter changes
  userSearchInput.addEventListener('input', displayUsers);
  roleFilter.addEventListener('change', displayUsers);
  statusFilter.addEventListener('change', displayUsers);
  
  // Add user button
  addUserBtn.addEventListener('click', openAddUserModal);
  
  // User form submission
  userForm.addEventListener('submit', handleUserFormSubmit);
  
  // Modal close buttons
  closeUserModal.addEventListener('click', closeModal);
  cancelUserBtn.addEventListener('click', closeModal);
  
  // Confirmation modal
  cancelConfirmBtn.addEventListener('click', () => {
    confirmModal.style.display = 'none';
  });
  
  okConfirmBtn.addEventListener('click', () => {
    if (userToDelete) {
      deleteUser(userToDelete);
    }
  });
  
  // Logout handlers
  headerLogoutBtn.addEventListener('click', () => {
    logoutModal.style.display = 'flex';
  });
  
  cancelLogoutBtn.addEventListener('click', () => {
    logoutModal.style.display = 'none';
  });
  
  confirmLogoutBtn.addEventListener('click', () => {
    // Implement logout functionality
    localStorage.clear();
    logoutModal.style.display = 'none';
    window.location.href = '../index.html';
  });
}

function openAddUserModal() {
  // Reset form
  userForm.reset();
  userIdInput.removeAttribute('readonly');
  passwordInput.setAttribute('required', 'required');
  
  // Set title
  userModalTitle.textContent = 'Add New User';
  
  // Reset editing state
  editingUserId = null;
  
  // Show modal
  userModal.style.display = 'flex';
}

function openEditUserModal(userId) {
  // Find the user
  const user = users.find(u => u.id === userId);
  if (!user) return;
  
  // Fill the form
  userIdInput.value = user.id;
  userIdInput.setAttribute('readonly', 'readonly'); // Can't change user ID
  fullNameInput.value = user.Name || '';
  passwordInput.value = ''; // Don't show the password
  passwordInput.removeAttribute('required'); // Not required for editing
  positionSelect.value = user.Position || '';
  shiftSelect.value = user.Shift || '';
  
  if (user.status === 'inactive') {
    statusInactive.checked = true;
  } else {
    statusActive.checked = true;
  }
  
  // Set title
  userModalTitle.textContent = 'Edit User';
  
  // Set editing state
  editingUserId = userId;
  
  // Show modal
  userModal.style.display = 'flex';
}

function handleUserFormSubmit(e) {
  e.preventDefault();
  
  // Get form values
  const userId = userIdInput.value.trim();
  const fullName = fullNameInput.value.trim();
  const password = passwordInput.value;
  const position = positionSelect.value;
  const shift = shiftSelect.value;
  const status = document.querySelector('input[name="status"]:checked').value;
  
  // Validate
  if (!userId || !fullName || !position || !shift) {
    showNotification("Please fill in all required fields.", "error");
    return;
  }
  
  // If adding a new user, password is required
  if (!editingUserId && !password) {
    showNotification("Password is required for new users.", "error");
    return;
  }
  
  // Prepare user data
  const userData = {
    Name: fullName,
    Position: position,
    Shift: shift,
    status: status,
    updatedAt: new Date().toISOString()
  };
  
  // If password is provided, add it to the update
  if (password) {
    userData.Password = password;
  }
  
  // Reference to user in database
  const userRef = ref(db, `users/${userId}`);
  
  // If editing
  if (editingUserId) {
    // Update existing user
    update(userRef, userData)
      .then(() => {
        showNotification(`User ${fullName} updated successfully.`, "success");
        closeModal();
      })
      .catch(error => {
        console.error("Error updating user:", error);
        showNotification("Failed to update user.", "error");
      });
  } else {
    // Check if user already exists
    get(userRef).then((snapshot) => {
      if (snapshot.exists()) {
        showNotification("User ID already exists. Please choose a different one.", "error");
        return;
      }
      
      // Add creation date for new users
      userData.createdAt = new Date().toISOString();
      
      // Create new user
      set(userRef, userData)
        .then(() => {
          showNotification(`User ${fullName} created successfully.`, "success");
          closeModal();
        })
        .catch(error => {
          console.error("Error creating user:", error);
          showNotification("Failed to create user.", "error");
        });
    });
  }
}

function openDeleteConfirmation(userId) {
  // Find the user
  const user = users.find(u => u.id === userId);
  if (!user) return;
  
  // Set the user to delete
  userToDelete = userId;
  
  // Set confirmation message
  confirmModalTitle.textContent = 'Delete User';
  confirmModalMessage.textContent = `Are you sure you want to delete user ${user.Name || userId}? This action cannot be undone.`;
  
  // Show modal
  confirmModal.style.display = 'flex';
}

function deleteUser(userId) {
  // Reference to user in database
  const userRef = ref(db, `users/${userId}`);
  
  // Remove the user
  remove(userRef)
    .then(() => {
      showNotification("User deleted successfully.", "success");
      confirmModal.style.display = 'none';
      userToDelete = null;
    })
    .catch(error => {
      console.error("Error deleting user:", error);
      showNotification("Failed to delete user.", "error");
      confirmModal.style.display = 'none';
    });
}

function closeModal() {
  userModal.style.display = 'none';
  userForm.reset();
}

function showNotification(message, type = 'info') {
  notification.textContent = message;
  notification.className = 'notification-bar';
  notification.classList.add(type);
  notification.style.display = 'block';
  
  // Hide notification after 5 seconds
  setTimeout(() => {
    notification.style.display = 'none';
  }, 5000);
}

function populateUserInfoInHeader() {
  // Get username from localStorage (saved during login)
  const username = localStorage.getItem("username");
  
  if (!username) {
    console.warn("Username not found in localStorage");
    return;
  }
  
  // Get user data from Firebase
  get(ref(db, `users/${username}`))
    .then((snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.val();
        
        // Set user full name
        if (userFullName && userData.Name) {
          userFullName.textContent = userData.Name;
        }
        
        // Set user shift
        if (userShift && userData.Shift) {
          userShift.textContent = userData.Shift;
          
          // Add appropriate styling based on shift
          userShift.className = 'user-role'; // Reset class
          
          if (userData.Shift === 'Non Shift') {
            userShift.classList.add('shift-non');
          } else if (userData.Shift === 'Blue Team') {
            userShift.classList.add('shift-blue');
          } else if (userData.Shift === 'Green Team') {
            userShift.classList.add('shift-green');
          }
        }
        
        // Set avatar initial
        if (userAvatar && userData.Name) {
          userAvatar.textContent = userData.Name.charAt(0).toUpperCase();
        }
      }
    })
    .catch((error) => {
      console.error("Error fetching user data:", error);
    });
}

// Initialize dropdown functionality
document.addEventListener('DOMContentLoaded', function() {
  // This is now handled via CSS :hover
});