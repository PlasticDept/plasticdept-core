// Import Firebase modules - adjust import paths as needed
import { db } from "./config.js";
import { ref, get, remove, onValue, off } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Store active listeners to properly clean them up later
const activeListeners = {
  picList: null,
  outboundProgress: null,
  outstandingJobs: null
};

// Updated function to remove a PIC using styled confirmation modal
async function removePIC(userId, name) {
  if (!userId) return;
  
  // Use the application's styled confirmation modal instead of browser alert
  showConfirmModal({
    title: "Konfirmasi",
    message: `Apakah Anda yakin ingin menghapus ${name || userId} dari daftar PIC?`,
    okText: "Hapus",
    cancelText: "Batal",
    okClass: "danger",
    onConfirm: async () => {
      try {
        await remove(ref(db, `MPPIC/${userId}`));
        showNotification(`PIC ${name || userId} berhasil dihapus`);
        // Refresh PIC list after removal
        setupPICListRealtime();
      } catch (error) {
        console.error("Error removing PIC:", error);
        showNotification(`Gagal menghapus PIC: ${error.message}`, true);
      }
    }
  });
}

/**
 * Updated modal confirmation function with improved styling
 */
function showConfirmModal({ title = "Konfirmasi", message = "Apakah Anda yakin?", okText = "OK", cancelText = "Batal", okClass = "", onConfirm, onCancel }) {
  const modal = document.getElementById("confirmModal");
  if (!modal) {
    console.error("Modal element not found");
    return;
  }
  
  // Update existing modal content with new structure
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${title}</h3>
      </div>
      <div class="modal-body">
        <p>${message}</p>
      </div>
      <div class="modal-footer">
        <button id="cancelConfirmBtn" class="modal-btn modal-btn-cancel">${cancelText}</button>
        <button id="okConfirmBtn" class="modal-btn modal-btn-ok ${okClass}">${okText}</button>
      </div>
    </div>
  `;

  // Set up event handlers
  const okBtn = document.getElementById("okConfirmBtn");
  const cancelBtn = document.getElementById("cancelConfirmBtn");

  okBtn.onclick = () => {
    modal.style.display = "none";
    if (typeof onConfirm === "function") onConfirm();
  };

  cancelBtn.onclick = () => {
    modal.style.display = "none";
    if (typeof onCancel === "function") onCancel();
  };

  // Display modal
  modal.style.display = "flex";

  // Close modal when clicking outside
  window.addEventListener("click", function handler(e) {
    if (e.target === modal) {
      modal.style.display = "none";
      window.removeEventListener("click", handler);
      if (typeof onCancel === "function") onCancel();
    }
  });
}

// Function to format numbers with thousand separators
function formatNumber(number) {
  if (number === undefined || number === null || isNaN(number)) {
    return "0";
  }
  return Number(number).toLocaleString();
}

// Function to show loading state on refresh buttons
function setButtonLoading(buttonId, isLoading) {
  const button = document.getElementById(buttonId);
  if (button) {
    if (isLoading) {
      button.classList.add('loading');
      button.disabled = true;
    } else {
      button.classList.remove('loading');
      button.disabled = false;
    }
  }
}

// Show notification message
function showNotification(message, isError = false) {
  const notification = document.getElementById('notification');
  if (!notification) return;
  
  notification.textContent = message;
  notification.style.display = 'block';
  notification.classList.toggle('error', isError);
  notification.classList.toggle('success', !isError);
  
  setTimeout(() => {
    notification.style.display = 'none';
  }, 4000);
}

// ========== PIC List Card Functions ==========
function setupPICListRealtime() {
  const picListContent = document.getElementById('picListContent');
  if (!picListContent) return;
  
  // Show loading state initially
  picListContent.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Loading PIC data...</div>';
  
  // Clean up any existing listener
  if (activeListeners.picList) {
    off(activeListeners.picList);
  }
  
  // Set up real-time listener
  const picRef = ref(db, "MPPIC");
  activeListeners.picList = picRef;
  
  onValue(picRef, (snapshot) => {
    if (picListContent) {
      picListContent.innerHTML = '';
      
      if (snapshot.exists()) {
        const picData = snapshot.val();
        
        if (Object.keys(picData).length === 0) {
          picListContent.innerHTML = '<div class="empty-state">No PIC data available</div>';
          return;
        }
        
        // Convert to array and sort by team then by name
        const picArray = Object.entries(picData).map(([userId, data]) => ({
          userId,
          ...data
        }));
        
        picArray.sort((a, b) => {
          // First sort by team
          if (a.team < b.team) return -1;
          if (a.team > b.team) return 1;
          
          // Then sort by name
          return a.name.localeCompare(b.name);
        });
        
        picArray.forEach(pic => {
          const picCard = document.createElement('div');
          picCard.className = 'pic-card';
          
          picCard.innerHTML = `
            <div class="pic-details">
              <div class="pic-name">${pic.name || 'Unknown'}</div>
              <div class="pic-team-userid">
                <span class="pic-team">${pic.team || 'No Team'}</span>
                <span class="pic-userid">ID: ${pic.userID || pic.userId || 'Unknown'}</span>
              </div>
            </div>
            <button class="pic-remove-btn" data-userid="${pic.userID || pic.userId}">
              <i class="fas fa-times"></i>
            </button>
          `;
          
          // Add event listener to remove button
          const removeBtn = picCard.querySelector('.pic-remove-btn');
          removeBtn.addEventListener('click', () => removePIC(pic.userID || pic.userId, pic.name));
          
          picListContent.appendChild(picCard);
        });
        
        // Add last updated indicator
        const lastUpdated = document.createElement('div');
        lastUpdated.className = 'last-updated';
        lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        picListContent.appendChild(lastUpdated);
      } else {
        picListContent.innerHTML = '<div class="empty-state">No PIC data available</div>';
      }
    }
  }, (error) => {
    console.error("Error loading PIC list:", error);
    if (picListContent) {
      picListContent.innerHTML = '<div class="empty-state">Error loading PIC data</div>';
    }
  });
}

// ========== Outbound Progress Card Functions ==========
function setupOutboundProgressRealtime() {
  const outboundProgressContent = document.getElementById('outboundProgressContent');
  if (!outboundProgressContent) return;
  
  // Show loading state initially
  outboundProgressContent.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Loading progress data...</div>';
  
  // We need to listen to both PlanTarget and PhxOutboundJobs nodes
  // and update the UI whenever either changes
  updateOutboundProgressData();
  
  // Set up listeners for both nodes
  setupOutboundDataListeners();
}

function setupOutboundDataListeners() {
  // Clean up any existing listeners
  if (activeListeners.outboundProgress) {
    activeListeners.outboundProgress.forEach(listener => off(listener));
  }
  
  const activeShift = localStorage.getItem("shiftType") === "Night" ? "Night Shift" : "Day Shift";
  const planTargetRef = ref(db, `PlanTarget/${activeShift}`);
  const jobsRef = ref(db, "PhxOutboundJobs");
  
  // Store listeners for cleanup
  activeListeners.outboundProgress = [planTargetRef, jobsRef];
  
  // Set up listeners
  onValue(planTargetRef, updateOutboundProgressData);
  onValue(jobsRef, updateOutboundProgressData);
}

async function updateOutboundProgressData() {
  const outboundProgressContent = document.getElementById('outboundProgressContent');
  if (!outboundProgressContent) return;
  
  try {
    // Get current shift from localStorage
    const activeShift = localStorage.getItem("shiftType") === "Night" ? "Night Shift" : "Day Shift";
    
    // Get plan targets from PlanTarget node
    const planTargetSnapshot = await get(ref(db, `PlanTarget/${activeShift}`));
    
    // Get job data to calculate actual target
    const jobsSnapshot = await get(ref(db, "PhxOutboundJobs"));
    
    outboundProgressContent.innerHTML = '';
    
    if (!planTargetSnapshot.exists()) {
      outboundProgressContent.innerHTML = '<div class="empty-state">No plan target data available</div>';
      return;
    }
    
    const planTargets = planTargetSnapshot.val();
    const jobs = jobsSnapshot.exists() ? jobsSnapshot.val() : {};
    
    const teams = Object.keys(planTargets);
    
    if (teams.length === 0) {
      outboundProgressContent.innerHTML = '<div class="empty-state">No team data available</div>';
      return;
    }
    
    // Track total plan target and actual values for Assigned Job section
    let totalPlanTarget = 0;
    let totalActualTarget = 0;
    
    // Calculate actual target for each team (rounded to integer)
    teams.forEach(team => {
      const planTarget = planTargets[team] || 0;
      totalPlanTarget += planTarget; // Add to total
      
      // Calculate actual target - sum qty for jobs assigned to this team and current shift with status "Packed" or "Completed"
      let actualTarget = 0;
      
      Object.values(jobs).forEach(job => {
        if (job.team === team && job.shift === activeShift && (job.status === "Packed" || job.status === "Completed")) {
          // Convert qty to number and add to total
          const qty = parseFloat(job.qty) || 0;
          actualTarget += qty;
        }
      });
      
      // Untuk total assigned job, hitung semua job yang di-assign terlepas dari statusnya
      Object.values(jobs).forEach(job => {
        if (job.team === team && job.shift === activeShift) {
          // Convert qty to number and add to total
          const qty = parseFloat(job.qty) || 0;
          totalActualTarget += qty;
        }
      });
      
      // Calculate progress percentage
      const percentage = planTarget > 0 ? Math.round((actualTarget / planTarget) * 100) : 0;
      
      // Create progress item
      const progressItem = document.createElement('div');
      progressItem.className = 'progress-item';
      
      progressItem.innerHTML = `
        <div class="progress-header">
          <div class="team-name">${team}</div>
          <div class="progress-metrics">
            <div class="progress-metric">
              <span class="progress-label">Plan Target:</span>
              <span class="progress-value">${formatNumber(planTarget)}</span>
            </div>
            <div class="progress-metric">
              <span class="progress-label">Actual:</span>
              <span class="progress-value">${formatNumber(actualTarget)}</span>
            </div>
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${percentage}%"></div>
        </div>
        <div class="progress-percentage">${percentage}% Completed</div>
      `;
      
      outboundProgressContent.appendChild(progressItem);
    });
    
    // Calculate total percentage
    const totalPercentage = totalPlanTarget > 0 ? Math.round((totalActualTarget / totalPlanTarget) * 100) : 0;
    
    
    // Add new "Assigned Job" section showing totals - dengan styling yang diseragamkan
    const totalProgressItem = document.createElement('div');
    totalProgressItem.className = 'progress-item'; // menghapus kelas total-progress untuk menyeragamkan style
    
    totalProgressItem.innerHTML = `
        <div class="progress-header">
          <div class="team-name">Assigned Job</div>
          <div class="progress-metrics">
            <div class="progress-metric">
              <span class="progress-label">Plan Target:</span>
              <span class="progress-value">${formatNumber(totalPlanTarget)}</span>
            </div>
            <div class="progress-metric">
              <span class="progress-label">Actual:</span>
              <span class="progress-value">${formatNumber(totalActualTarget)}</span>
            </div>
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${totalPercentage}%"></div>
        </div>
        <div class="progress-percentage">${totalPercentage}% Completed</div>
    `;
    
    outboundProgressContent.appendChild(totalProgressItem);
    
    // Add last updated indicator
    const lastUpdated = document.createElement('div');
    lastUpdated.className = 'last-updated';
    lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    outboundProgressContent.appendChild(lastUpdated);
  } catch (error) {
    console.error("Error updating outbound progress:", error);
    if (outboundProgressContent) {
      outboundProgressContent.innerHTML = '<div class="empty-state">Error loading progress data</div>';
    }
  }
}

// ========== Outstanding Jobs Card Functions ==========
function setupOutstandingJobsRealtime() {
  const outstandingJobsContent = document.getElementById('outstandingJobsContent');
  if (!outstandingJobsContent) return;
  
  // Show loading state initially
  outstandingJobsContent.innerHTML = '<div class="loading-indicator"><i class="fas fa-spinner fa-spin"></i> Loading outstanding jobs data...</div>';
  
  // Clean up any existing listener
  if (activeListeners.outstandingJobs) {
    off(activeListeners.outstandingJobs);
  }
  
  // Set up real-time listener
  const jobsRef = ref(db, "PhxOutboundJobs");
  activeListeners.outstandingJobs = jobsRef;
  
  onValue(jobsRef, (snapshot) => {
    if (!outstandingJobsContent) return;
    outstandingJobsContent.innerHTML = '';
    
    if (!snapshot.exists()) {
      outstandingJobsContent.innerHTML = '<div class="empty-state">No outstanding job data available</div>';
      return;
    }
    
    const jobs = snapshot.val();
    let outstandingJobs = [];
    let totalOutstandingQty = 0;
    
    // Filter for jobs with status "pending pick" and no shift assigned
    Object.values(jobs).forEach(job => {
      if (
        job.status && 
        job.status.toLowerCase() === "pending pick" && 
        (!job.shift || job.shift.trim() === "")
      ) {
        outstandingJobs.push(job);
        // Add qty to total
        const qty = parseFloat(job.qty) || 0;
        totalOutstandingQty += qty;
      }
    });
    
    // Create content
    const outstandingContent = document.createElement('div');
    outstandingContent.className = 'outstanding-content';
    
    outstandingContent.innerHTML = `
      <div class="outstanding-count">${outstandingJobs.length}</div>
      <div class="outstanding-label">Outstanding jobs with "Pending Pick" status</div>
      <div class="outstanding-qty">${formatNumber(totalOutstandingQty)}</div>
      <div class="outstanding-note">Total quantity from unassigned jobs</div>
    `;
    
    outstandingJobsContent.appendChild(outstandingContent);
    
    // Add last updated indicator
    const lastUpdated = document.createElement('div');
    lastUpdated.className = 'last-updated';
    lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    outstandingJobsContent.appendChild(lastUpdated);
  }, (error) => {
    console.error("Error loading outstanding jobs:", error);
    if (outstandingJobsContent) {
      outstandingJobsContent.innerHTML = '<div class="empty-state">Error loading outstanding jobs data</div>';
    }
  });
}

// Function to clean up all listeners when navigating away
function cleanupListeners() {
  // Clean up PIC list listener
  if (activeListeners.picList) {
    off(activeListeners.picList);
  }
  
  // Clean up outbound progress listeners
  if (activeListeners.outboundProgress) {
    activeListeners.outboundProgress.forEach(listener => off(listener));
  }
  
  // Clean up outstanding jobs listener
  if (activeListeners.outstandingJobs) {
    off(activeListeners.outstandingJobs);
  }
}

// ========== Initialize and Setup Event Listeners ==========
document.addEventListener('DOMContentLoaded', function() {
  // Set up real-time data listeners
  setupPICListRealtime();
  setupOutboundProgressRealtime();
  setupOutstandingJobsRealtime();
  
  // Setup refresh button listeners (as fallback)
  document.getElementById('refreshPicListBtn')?.addEventListener('click', () => {
    setButtonLoading('refreshPicListBtn', true);
    setupPICListRealtime();
    setTimeout(() => setButtonLoading('refreshPicListBtn', false), 500);
  });
  
  document.getElementById('refreshOutboundProgressBtn')?.addEventListener('click', () => {
    setButtonLoading('refreshOutboundProgressBtn', true);
    updateOutboundProgressData();
    setTimeout(() => setButtonLoading('refreshOutboundProgressBtn', false), 500);
  });
  
  document.getElementById('refreshOutstandingJobsBtn')?.addEventListener('click', () => {
    setButtonLoading('refreshOutstandingJobsBtn', true);
    setupOutstandingJobsRealtime();
    setTimeout(() => setButtonLoading('refreshOutstandingJobsBtn', false), 500);
  });
  
  // Listen for shift changes to update outbound progress
  const shiftRadios = document.querySelectorAll('input[name="shiftType"]');
  shiftRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      setupOutboundDataListeners(); // Re-setup listeners with the new shift
      updateOutboundProgressData(); // Update the data immediately
    });
  });
  
  // Clean up listeners when navigating away from the page
  window.addEventListener('beforeunload', cleanupListeners);
});

// Simplified CSS untuk memastikan tampilan seragam
const style = document.createElement('style');
style.textContent = `
  .last-updated {
    text-align: right;
    font-size: 11px;
    color: #999;
    font-style: italic;
    margin-top: 10px;
    padding-top: 5px;
    border-top: 1px dashed #eee;
  }
  
  .progress-separator {
    margin: 15px 0;
    border: 0;
    border-top: 1px dashed #ccc;
  }
`;
document.head.appendChild(style);

// Export functions for external use
export {
  setupPICListRealtime,
  setupOutboundProgressRealtime,
  setupOutstandingJobsRealtime,
  cleanupListeners
};