document.addEventListener('DOMContentLoaded', function() {
    // Navigation menu toggle
    const hamburger = document.querySelector('.hamburger');
    const mainMenu = document.querySelector('.main-menu');
    
    if (hamburger) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            mainMenu.classList.toggle('active');
        });
    }
    
    // Smooth scrolling for internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            if (mainMenu.classList.contains('active')) {
                hamburger.classList.remove('active');
                mainMenu.classList.remove('active');
            }
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80, // Header height
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Active menu based on scroll
    window.addEventListener('scroll', function() {
        const sections = document.querySelectorAll('section');
        const navItems = document.querySelectorAll('.main-menu a');
        
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.clientHeight;
            
            if (pageYOffset >= sectionTop && pageYOffset < sectionTop + sectionHeight) {
                current = '#' + section.getAttribute('id');
            }
        });
        
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === current) {
                item.classList.add('active');
            }
        });
        
        // Sticky header
        const header = document.querySelector('header');
        if (window.scrollY > 100) {
            header.style.height = '70px';
        } else {
            header.style.height = '80px';
        }
    });
    
    // Tabs functionality
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    if (tabButtons.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                tabButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                this.classList.add('active');
                
                // Get the tab to show
                const tabId = this.getAttribute('data-tab');
                
                // Hide all tab panes
                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.remove('active');
                });
                
                // Show the selected tab pane
                document.getElementById(tabId).classList.add('active');
            });
        });
    }
    
    // Portfolio filtering
    const filterButtons = document.querySelectorAll('.filter-btn');
    const portfolioItems = document.querySelectorAll('.portfolio-item');
    
    if (filterButtons.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                filterButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked button
                this.classList.add('active');
                
                // Get the filter value
                const filterValue = this.getAttribute('data-filter');
                
                // Show/hide portfolio items based on filter
                portfolioItems.forEach(item => {
                    if (filterValue === 'all' || item.getAttribute('data-category') === filterValue) {
                        item.style.display = 'block';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        });
    }
    
    // Testimonials slider
    const testimonialDots = document.querySelectorAll('.dot');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    const testimonialItems = document.querySelectorAll('.testimonial-item');
    let currentTestimonial = 0;
    
    function showTestimonial(index) {
        // Hide all testimonials
        testimonialItems.forEach(item => {
            item.style.display = 'none';
        });
        
        // Remove active class from all dots
        testimonialDots.forEach(dot => {
            dot.classList.remove('active');
        });
        
        // Show the current testimonial
        testimonialItems[index].style.display = 'block';
        
        // Add active class to current dot
        testimonialDots[index].classList.add('active');
    }
    
    if (testimonialItems.length > 0) {
        // Show first testimonial by default
        showTestimonial(currentTestimonial);
        
        // Previous button click
        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                currentTestimonial--;
                if (currentTestimonial < 0) {
                    currentTestimonial = testimonialItems.length - 1;
                }
                showTestimonial(currentTestimonial);
            });
        }
        
        // Next button click
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                currentTestimonial++;
                if (currentTestimonial >= testimonialItems.length) {
                    currentTestimonial = 0;
                }
                showTestimonial(currentTestimonial);
            });
        }
        
        // Dot click
        testimonialDots.forEach((dot, index) => {
            dot.addEventListener('click', function() {
                currentTestimonial = index;
                showTestimonial(currentTestimonial);
            });
        });
        
        // Auto slide testimonials
        setInterval(function() {
            currentTestimonial++;
            if (currentTestimonial >= testimonialItems.length) {
                currentTestimonial = 0;
            }
            showTestimonial(currentTestimonial);
        }, 5000);
    }
});