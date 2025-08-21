// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAfIYig9-sv3RfazwAW6X937_5HJfgnYt4",
  authDomain: "outobund.firebaseapp.com",
  databaseURL: "https://outobund-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "outobund",
  storageBucket: "outobund.firebasestorage.app",
  messagingSenderId: "84643346476",
  appId: "1:84643346476:web:beb19c5ea0884fcb083989"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

/**
 * Updates the user profile information in the header
 */
function updateUserProfile() {
  const username = localStorage.getItem("username");
  if (!username) return;

  const userFullNameElement = document.getElementById('userFullName');
  const userAvatarElement = document.getElementById('userAvatar');
  const userShiftElement = document.getElementById('userShift');

  try {
    const userRef = ref(db, `users/${username}`);
    get(userRef).then(snapshot => {
      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userFullNameElement) userFullNameElement.textContent = userData.Name || username;
        if (userAvatarElement) {
          if (userData.AvatarUrl) {
            userAvatarElement.innerHTML = `<img src="${userData.AvatarUrl}" alt="Avatar" style="width:32px;height:32px;border-radius:50%;">`;
          } else {
            userAvatarElement.textContent = (userData.Name || username).charAt(0).toUpperCase();
          }
        }
        if (userShiftElement) userShiftElement.textContent = userData.Shift || "-";
        
        // Update shift background color
        updateUserShiftColor();
      } else {
        if (userFullNameElement) userFullNameElement.textContent = username;
        if (userAvatarElement) userAvatarElement.textContent = username.charAt(0).toUpperCase();
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
  }
}

/**
 * Updates the color of the user shift badge based on the shift name
 */
function updateUserShiftColor() {
  const userShiftSpan = document.getElementById('userShift');
  if (!userShiftSpan) return;
  
  const value = userShiftSpan.textContent.trim();
  userShiftSpan.style.background = '';
  userShiftSpan.style.color = '';
  userShiftSpan.style.borderRadius = '6px';
  userShiftSpan.style.padding = '2px 8px';
  userShiftSpan.style.fontWeight = 'bold';
  userShiftSpan.style.display = 'inline-block';
  
  if (value === 'Non Shift') {
    userShiftSpan.style.background = '#ffe066';
    userShiftSpan.style.color = '#333';
  } else if (value.toLowerCase().includes('blue')) {
    userShiftSpan.style.background = '#2196f3';
    userShiftSpan.style.color = '#fff';
  } else if (value.toLowerCase().includes('green')) {
    userShiftSpan.style.background = '#43a047';
    userShiftSpan.style.color = '#fff';
  } else if (value.toLowerCase().includes('night')) {
    userShiftSpan.style.background = '#222e50';
    userShiftSpan.style.color = '#fff';
  } else if (value.toLowerCase().includes('day')) {
    userShiftSpan.style.background = '#f7b32b';
    userShiftSpan.style.color = '#222';
  }
}

/**
 * Handles the logout functionality
 */
function setupLogoutButton() {
  const logoutBtn = document.getElementById('headerLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      // Clear local storage
      localStorage.removeItem('username');
      localStorage.removeItem('authToken');
      
      // Sign out from Firebase
      signOut(auth).then(() => {
        // Redirect to login page
        window.location.href = "/login.html";
      }).catch((error) => {
        console.error("Error signing out:", error);
      });
    });
  }
}

// Initialize user profile when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  updateUserProfile();
  setupLogoutButton();
});

// Export functions for external use if needed
export { updateUserProfile, updateUserShiftColor };