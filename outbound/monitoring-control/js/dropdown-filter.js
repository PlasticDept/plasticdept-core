/**
 * dropdown-filter.js - Handles all dropdown interactions
 * Supports filter dropdowns, tab dropdowns, and navigation dropdowns
 */

document.addEventListener('DOMContentLoaded', function() {
  // Delay sedikit untuk memastikan DOM sudah siap
  setTimeout(() => {
    // ===== ELEMENT REFERENCES =====
    
    // Referensi elemen-elemen dropdown
    const dropdownElements = {
      // Filter dropdowns
      filter: {
        status: {
          button: document.getElementById('sortStatusBtn'),
          content: document.getElementById('statusDropdown')
        },
        date: {
          button: document.getElementById('sortDateBtn'),
          content: document.getElementById('dateDropdown')
        },
        team: {
          button: document.getElementById('sortTeamBtn'),
          content: document.getElementById('teamDropdown')
        }
      },
      // Tab dropdowns
      tabDropdowns: document.querySelectorAll('.tab-dropdown'),
      // Nav dropdowns
      navDropdowns: document.querySelectorAll('.nav-dropdown')
    };

    // ===== HELPER FUNCTIONS =====
    
    // Fungsi untuk menutup semua dropdown
    function closeAllDropdowns() {
      // Tutup filter dropdowns
      ['status', 'date', 'team'].forEach(type => {
        const content = dropdownElements.filter[type].content;
        if (content) content.style.display = "none";
      });
      
      // Tutup tab dropdowns
      dropdownElements.tabDropdowns.forEach(dropdown => {
        const content = dropdown.querySelector('.tab-dropdown-content');
        if (content) content.style.display = "none";
      });
      
      // Tutup nav dropdowns
      dropdownElements.navDropdowns.forEach(dropdown => {
        const content = dropdown.querySelector('.nav-dropdown-content');
        if (content) content.style.display = "none";
      });
    }
    
    // Fungsi untuk mengatur event listener filter dropdown
    function setupFilterDropdown(type) {
      const { button, content } = dropdownElements.filter[type];
      
      if (button && content) {
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isCurrentlyOpen = content.style.display === "block";
          closeAllDropdowns();
          if (!isCurrentlyOpen) {
            content.style.display = "block";
          }
        });
      }
    }

    // ===== SETUP FILTER DROPDOWNS =====
    
    // Setup event listeners untuk semua filter dropdowns
    ['status', 'date', 'team'].forEach(setupFilterDropdown);
    
    // ===== SETUP TAB DROPDOWNS =====
    
    // Setup event listeners untuk tab dropdowns
    dropdownElements.tabDropdowns.forEach(dropdown => {
      const dropdownTab = dropdown.querySelector('.tab');
      const dropdownContent = dropdown.querySelector('.tab-dropdown-content');
      
      if (dropdownTab && dropdownContent) {
        // Perilaku hover
        dropdown.addEventListener('mouseenter', () => {
          dropdownContent.style.display = 'block';
          
          // Cek dan sesuaikan posisi jika keluar viewport
          const rect = dropdownContent.getBoundingClientRect();
          const viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
          
          if (rect.bottom > viewHeight) {
            dropdownContent.style.top = 'auto';
            dropdownContent.style.bottom = '100%';
          } else {
            dropdownContent.style.top = '100%';
            dropdownContent.style.bottom = 'auto';
          }
        });
        
        dropdown.addEventListener('mouseleave', () => {
          dropdownContent.style.display = 'none';
        });
        
        // Perilaku klik untuk perangkat sentuh
        dropdownTab.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (dropdownContent.style.display === 'block') {
            dropdownContent.style.display = 'none';
          } else {
            closeAllDropdowns();
            dropdownContent.style.display = 'block';
          }
        });
      }
    });
    
    // ===== SETUP NAV DROPDOWNS =====
    
    // Setup event listeners untuk nav dropdowns
    dropdownElements.navDropdowns.forEach(dropdown => {
      const dropdownLink = dropdown.querySelector('.nav-link');
      const dropdownContent = dropdown.querySelector('.nav-dropdown-content');
      
      if (dropdownLink && dropdownContent) {
        // Perilaku hover
        dropdown.addEventListener('mouseenter', () => {
          dropdownContent.style.display = 'block';
          dropdownContent.style.zIndex = '99999';
          dropdown.style.zIndex = '99999';
          
          // Cek dan sesuaikan posisi jika keluar viewport
          const rect = dropdownContent.getBoundingClientRect();
          const viewWidth = Math.max(document.documentElement.clientWidth, window.innerWidth);
          
          if (rect.right > viewWidth) {
            dropdownContent.style.left = 'auto';
            dropdownContent.style.right = '0';
          } else {
            dropdownContent.style.left = '0';
            dropdownContent.style.right = 'auto';
          }
          
          // Force reflow untuk memastikan DOM memperbarui tampilan
          void dropdownContent.offsetHeight;
        });
        
        dropdown.addEventListener('mouseleave', () => {
          dropdownContent.style.display = 'none';
        });
        
        // Perilaku klik untuk perangkat sentuh
        dropdownLink.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (dropdownContent.style.display === 'block') {
            dropdownContent.style.display = 'none';
          } else {
            closeAllDropdowns();
            dropdownContent.style.display = 'block';
            dropdownContent.style.zIndex = '99999';
            dropdown.style.zIndex = '99999';
          }
        });
      }
    });
    
    // ===== FIX UNTUK REPORTS DROPDOWN =====
    
    // Perbaikan khusus untuk dropdown Reports
    const reportsDropdown = document.querySelector('.nav-dropdown');
    if (reportsDropdown) {
      // Pastikan dropdown tidak terhalang
      document.body.addEventListener('click', function(e) {
        // Menghentikan event bubbling jika klik di dalam dropdown
        if (reportsDropdown.contains(e.target)) {
          e.stopPropagation();
        }
      }, true); // Use capture phase
    }
    
    // ===== GLOBAL CLICK HANDLER =====
    
    // Handler klik global untuk menutup dropdown saat mengklik di luar
    document.addEventListener('click', (e) => {
      // Jika klik di luar elemen dropdown manapun, tutup semua dropdown
      if (!e.target.closest('.dropdown') && 
          !e.target.closest('.tab-dropdown') && 
          !e.target.closest('.nav-dropdown')) {
        closeAllDropdowns();
      }
    });
    
    console.log('✅ All dropdown listeners have been properly attached');
  }, 500);
});