/**
 * UI Enhancement Module untuk Outbound Job Assignment
 * Menggabungkan semua peningkatan UI dan fungsi yang tadinya ada di HTML
 */

// Tunggu dokumen siap
document.addEventListener('DOMContentLoaded', () => {
  enhanceUserInterface();
});

// Fungsi utama untuk meningkatkan UI
function enhanceUserInterface() {
  // Tambahkan class styling ke container utama
  document.querySelector('.container')?.classList.add('professional-ui');
  
  // Set up file input name display
  setupFileInput();
  
  // Setup dropdown filters
  setupDropdowns();
  
  // Setup modal dialogs
  setupModals();
  
  // Tingkatkan tampilan notifikasi
  enhanceNotifications();
  
  // Tingkatkan tombol dan form
  enhanceButtons();
  enhanceFormControls();
  
  // Tambahkan animasi pada tabel
  enhanceTableInteractions();
}

// Setup file input dengan visual feedback
function setupFileInput() {
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      const fileName = e.target.files[0] ? e.target.files[0].name : 'No file chosen';
      const fileNameElement = document.getElementById('fileName');
      if (fileNameElement) {
        fileNameElement.textContent = fileName;
      }
    });
  }
}

// Setup dropdown filters
function setupDropdowns() {
  // Toggle dropdown menus
  document.querySelectorAll('.filter-dropdown-toggle').forEach(toggle => {
    toggle.addEventListener('click', function() {
      const dropdown = this.closest('.filter-dropdown');
      document.querySelectorAll('.filter-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
      });
      dropdown.classList.toggle('open');
    });
  });
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.filter-dropdown')) {
      document.querySelectorAll('.filter-dropdown').forEach(d => {
        d.classList.remove('open');
      });
    }
  });
}

// Setup modal functionality
function setupModals() {
  // Show modal function
  window.showModalWithId = function(modalId) {
    const backdrop = document.getElementById(modalId + 'Backdrop');
    if (backdrop) backdrop.classList.add('show');
  };
  
  // Hide modal function
  window.hideModalWithId = function(modalId) {
    const backdrop = document.getElementById(modalId + 'Backdrop');
    if (backdrop) backdrop.classList.remove('show');
  };
  
  // Override existing modal functions for backward compatibility
  window.showModal = function() {
    window.showModalWithId('assign');
  };
  
  window.hideModal = function() {
    window.hideModalWithId('assign');
  };
  
  // Close modal with close buttons
  document.querySelectorAll('.modal-close, #cancelAssign, #cancelConfirmBtn, #cancelLogoutBtn').forEach(btn => {
    btn.addEventListener('click', function() {
      const modalBackdrop = this.closest('.modal-backdrop');
      if (modalBackdrop) modalBackdrop.classList.remove('show');
    });
  });
  
  // Close modal when clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('show');
      }
    });
  });
  
  // Close modal with Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.show').forEach(backdrop => {
        backdrop.classList.remove('show');
      });
    }
  });
}

// Peningkatan sistem notifikasi
function enhanceNotifications() {
  const originalShowNotification = window.showNotification;
  
  if (originalShowNotification) {
    // Override fungsi notifikasi yang ada
    window.showNotification = function(message, isError = false) {
      // Panggil implementasi asli jika tersedia
      if (typeof originalShowNotification === 'function') {
        originalShowNotification(message, isError);
      }
      
      // Tambahkan animasi dan styling yang lebih baik
      const notification = document.getElementById('notification');
      if (!notification) return;
      
      // Pastikan elemen memiliki struktur yang benar
      if (!notification.querySelector('.notification-content')) {
        notification.innerHTML = `
          <div class="notification-content">
            <div class="notification-icon">
              ${isError ? 
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>' : 
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'}
            </div>
            <div class="notification-message">
              <div class="notification-title">${isError ? 'Error' : 'Success'}</div>
              <div class="notification-text">${message}</div>
            </div>
          </div>
        `;
      } else {
        // Update konten yang sudah ada
        const textElement = notification.querySelector('.notification-text');
        const titleElement = notification.querySelector('.notification-title');
        if (textElement) textElement.textContent = message;
        if (titleElement) titleElement.textContent = isError ? 'Error' : 'Success';
      }
    };
  }
}

// Peningkatan tombol
function enhanceButtons() {
  // Tambahkan class dan ikon ke tombol
  document.querySelectorAll('button').forEach(btn => {
    if (!btn.classList.contains('btn')) {
      btn.classList.add('btn');
      
      // Tambahkan class sesuai jenis tombol
      if (btn.classList.contains('danger')) {
        btn.classList.add('btn-danger');
      } else if (btn.id === 'uploadBtn' || btn.id === 'bulkAddBtn' || 
                btn.id.includes('set') || btn.classList.contains('assign')) {
        btn.classList.add('btn-primary');
      } else if (btn.classList.contains('unassign')) {
        btn.classList.add('btn-secondary');
      }
    }
  });
}

// Peningkatan kontrol form
function enhanceFormControls() {
  // Tingkatkan input dan select
  document.querySelectorAll('input[type="number"], input[type="text"], select').forEach(input => {
    if (!input.classList.contains('form-control')) {
      input.classList.add('form-control');
    }
  });
  
  // Tingkatkan file input jika belum ditingkatkan
  const fileInput = document.getElementById('fileInput');
  if (fileInput && !document.getElementById('fileName')) {
    const fileInputParent = fileInput.parentElement;
    
    // Buat wrapper
    const fileWrapper = document.createElement('div');
    fileWrapper.className = 'file-upload';
    
    // Buat label
    const fileLabel = document.createElement('label');
    fileLabel.setAttribute('for', 'fileInput');
    fileLabel.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
      Choose File
    `;
    
    // Buat span untuk nama file
    const fileName = document.createElement('span');
    fileName.className = 'file-name';
    fileName.id = 'fileName';
    fileName.textContent = 'No file chosen';
    
    // Ganti elemen asli
    fileInputParent.insertBefore(fileWrapper, fileInput);
    fileWrapper.appendChild(fileInput);
    fileWrapper.appendChild(fileLabel);
    fileWrapper.appendChild(fileName);
  }
}

// Peningkatan interaksi tabel
function enhanceTableInteractions() {
  const table = document.getElementById('jobTable');
  if (!table) return;
  
  // Animasi saat baris baru ditambahkan
  const originalCreateTableRow = window.createTableRow;
  if (originalCreateTableRow) {
    window.createTableRow = function(job) {
      const row = originalCreateTableRow(job);
      row.classList.add('new-row');
      setTimeout(() => row.classList.remove('new-row'), 1000);
      return row;
    };
  }
  
  // Highlight pada hover
  const observeTable = () => {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length) {
          table.querySelectorAll('tbody tr:not(.has-hover-effect)').forEach(row => {
            row.classList.add('has-hover-effect');
            row.addEventListener('mouseenter', () => {
              row.classList.add('row-hover');
            });
            row.addEventListener('mouseleave', () => {
              row.classList.remove('row-hover');
            });
          });
        }
      });
    });
    
    observer.observe(table, { childList: true, subtree: true });
    
    // Juga proses baris yang sudah ada
    table.querySelectorAll('tbody tr:not(.has-hover-effect)').forEach(row => {
      row.classList.add('has-hover-effect');
      row.addEventListener('mouseenter', () => {
        row.classList.add('row-hover');
      });
      row.addEventListener('mouseleave', () => {
        row.classList.remove('row-hover');
      });
    });
  };
  
  observeTable();
}

// Enhanced version of showConfirmModal
function enhanceConfirmModal() {
  const originalShowConfirmModal = window.showConfirmModal;
  
  if (originalShowConfirmModal) {
    window.showConfirmModal = function(options) {
      // Pastikan backdrop dan modal ada
      const backdrop = document.getElementById('confirmModalBackdrop');
      if (backdrop) {
        const title = document.getElementById('confirmModalTitle');
        const message = document.getElementById('confirmModalMessage');
        const okBtn = document.getElementById('okConfirmBtn');
        const cancelBtn = document.getElementById('cancelConfirmBtn');
        
        if (title) title.textContent = options.title || 'Confirmation';
        if (message) message.innerHTML = options.message || 'Are you sure?';
        if (okBtn) {
          okBtn.textContent = options.okText || 'OK';
          okBtn.className = 'btn btn-primary';
          if (options.okClass) {
            if (options.okClass === 'logout') {
              okBtn.classList.remove('btn-primary');
              okBtn.classList.add('btn-danger');
            } else {
              okBtn.classList.add(options.okClass);
            }
          }
        }
        if (cancelBtn) cancelBtn.textContent = options.cancelText || 'Cancel';
        
        // Ganti event listeners
        if (okBtn) {
          const newOkBtn = okBtn.cloneNode(true);
          okBtn.parentNode.replaceChild(newOkBtn, okBtn);
          newOkBtn.onclick = () => {
            backdrop.classList.remove('show');
            if (typeof options.onConfirm === 'function') options.onConfirm();
          };
        }
        
        if (cancelBtn) {
          const newCancelBtn = cancelBtn.cloneNode(true);
          cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
          newCancelBtn.onclick = () => {
            backdrop.classList.remove('show');
            if (typeof options.onCancel === 'function') options.onCancel();
          };
        }
        
        // Tampilkan modal
        backdrop.classList.add('show');
      } else {
        // Fallback ke fungsi asli
        originalShowConfirmModal(options);
      }
    };
  }
}

// Add CSS Animation Effects
function addCssAnimations() {
  const style = document.createElement('style');
  style.textContent = `
    /* Row animations */
    .new-row {
      animation: highlightRow 1s ease-out;
    }
    
    @keyframes highlightRow {
      0% { background-color: rgba(33, 118, 174, 0.2); }
      100% { background-color: transparent; }
    }
    
    .row-hover {
      background-color: var(--primary-light) !important;
      transition: background-color 0.2s;
    }
    
    /* Smooth transitions for all interactive elements */
    button, input, select, .dropdown-toggle, .modal-content, .notification {
      transition: all 0.2s ease-out;
    }
    
    /* Button press effect */
    .btn:active {
      transform: scale(0.97);
    }
  `;
  document.head.appendChild(style);
}

// Run additional enhancements
enhanceConfirmModal();
addCssAnimations();

// Export fungsi untuk digunakan di sortir.js
export {
  enhanceUserInterface,
  enhanceNotifications,
  enhanceButtons,
  enhanceFormControls,
  enhanceTableInteractions,
  showModalWithId,
  hideModalWithId
};