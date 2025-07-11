/**
 * Compatibility layer untuk mengatasi perbedaan antara UI lama dan baru
 * File ini harus dimuat sebelum sortir.js
 */

// Tunggu dokumen siap
document.addEventListener('DOMContentLoaded', function() {
  // Menangani kasus elemen closeModal yang tidak ada
  if (!document.getElementById('closeModal')) {
    // Buat elemen dummy yang tersembunyi
    const dummyCloseModal = document.createElement('span');
    dummyCloseModal.id = 'closeModal';
    dummyCloseModal.style.display = 'none';
    document.body.appendChild(dummyCloseModal);
    
    // Tambahkan event listener ke elemen dummy
    dummyCloseModal.addEventListener('click', function() {
      // Jika ada fungsi hideModal, gunakan
      if (typeof window.hideModal === 'function') {
        window.hideModal();
      }
      
      // Sembunyikan semua modal backdrop sebagai fallback
      document.querySelectorAll('.modal-backdrop').forEach(function(backdrop) {
        backdrop.classList.remove('show');
      });
      
      // Sembunyikan modal lama jika ada
      const oldModal = document.getElementById('addModal');
      if (oldModal) {
        oldModal.style.display = 'none';
      }
    });
    
    // Sambungkan event listener antara elemen baru dan lama
    document.querySelectorAll('.modal-close, #closeAssignModal').forEach(function(closeBtn) {
      closeBtn.addEventListener('click', function() {
        dummyCloseModal.click();
      });
    });
  }
  
  // Elemen modal lainnya yang mungkin perlu dihandle
  const elementsToCheck = [
    'addModal', 'confirmModal', 'logoutModal', 'exportLoadingOverlay'
  ];
  
  elementsToCheck.forEach(function(id) {
    if (!document.getElementById(id)) {
      const dummyElement = document.createElement('div');
      dummyElement.id = id;
      dummyElement.style.display = 'none';
      document.body.appendChild(dummyElement);
    }
  });
  
  // Pastikan fungsi global yang diperlukan ada
  if (!window.showModal) {
    window.showModal = function() {
      const backdrop = document.getElementById('assignModalBackdrop');
      if (backdrop) backdrop.classList.add('show');
    };
  }
  
  if (!window.hideModal) {
    window.hideModal = function() {
      const backdrop = document.getElementById('assignModalBackdrop');
      if (backdrop) backdrop.classList.remove('show');
    };
  }
});