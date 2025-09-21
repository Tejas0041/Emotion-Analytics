// Modern App Enhancement Script - Safe Version
document.addEventListener('DOMContentLoaded', function() {
    console.log('App.js loaded successfully');
    
    try {
        // Add loading states to all forms
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', function(e) {
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn && !submitBtn.classList.contains('loading')) {
                    submitBtn.classList.add('loading');
                    
                    // Add loading animation
                    const originalContent = submitBtn.innerHTML;
                    submitBtn.innerHTML = '<div class="loading"></div> <span>Processing...</span>';
                    
                    // Prevent double submission
                    submitBtn.disabled = true;
                    
                    // Re-enable after 5 seconds as fallback
                    setTimeout(() => {
                        submitBtn.disabled = false;
                        submitBtn.classList.remove('loading');
                        submitBtn.innerHTML = originalContent;
                    }, 5000);
                }
            });
        });
    } catch (error) {
        console.warn('Error setting up form loading states:', error);
    }
    
    try {
        // Add hover effects to cards
        const cards = document.querySelectorAll('.modern-card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-4px)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
        });
    } catch (error) {
        console.warn('Error setting up card hover effects:', error);
    }
    
    try {
        // Enhanced form validation feedback
        const inputs = document.querySelectorAll('.form-input');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                if (this.parentElement) {
                    this.parentElement.classList.add('focused');
                }
            });
            
            input.addEventListener('blur', function() {
                if (this.parentElement) {
                    this.parentElement.classList.remove('focused');
                    
                    if (this.value.length > 0) {
                        this.parentElement.classList.add('filled');
                    } else {
                        this.parentElement.classList.remove('filled');
                    }
                }
            });
            
            // Real-time validation
            input.addEventListener('input', function() {
                const feedback = this.parentElement ? this.parentElement.querySelector('.invalid-feedback') : null;
                if (this.checkValidity()) {
                    this.style.borderColor = 'var(--success-color)';
                    if (feedback) feedback.style.display = 'none';
                } else if (this.value.length > 0) {
                    this.style.borderColor = 'var(--error-color)';
                    if (feedback) feedback.style.display = 'block';
                } else {
                    this.style.borderColor = 'var(--border)';
                    if (feedback) feedback.style.display = 'none';
                }
            });
        });
    } catch (error) {
        console.warn('Error setting up form validation:', error);
    }
    
    try {
        // Add smooth scrolling to valid anchor links only
        const anchorLinks = document.querySelectorAll('a[href]');
        anchorLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                
                // Only handle valid anchor links (not empty, not just "#", and starts with "#")
                if (href && href.startsWith('#') && href.length > 1) {
                    try {
                        // Validate that it's a proper CSS selector
                        if (href.match(/^#[a-zA-Z][a-zA-Z0-9_-]*$/)) {
                            const target = document.querySelector(href);
                            if (target) {
                                e.preventDefault();
                                target.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'start'
                                });
                            }
                        }
                    } catch (selectorError) {
                        // Silently ignore invalid selectors
                    }
                }
            });
        });
    } catch (error) {
        console.warn('Error setting up smooth scrolling:', error);
    }
    
    try {
        // Add ripple effect to buttons
        const buttons = document.querySelectorAll('.btn-modern');
        buttons.forEach(button => {
            button.addEventListener('click', function(e) {
                // Skip ripple for logout buttons to avoid conflicts
                if (this.getAttribute('onclick') && this.getAttribute('onclick').includes('showLogoutConfirmation')) {
                    return;
                }
                
                const ripple = document.createElement('span');
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                ripple.classList.add('ripple');
                
                this.appendChild(ripple);
                
                setTimeout(() => {
                    if (ripple.parentNode) {
                        ripple.remove();
                    }
                }, 600);
            });
        });
    } catch (error) {
        console.warn('Error setting up button ripple effects:', error);
    }
});

// Add CSS for ripple effect
const style = document.createElement('style');
style.textContent = `
    .btn-modern {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .form-group.focused .form-label {
        color: var(--primary-color);
    }
    
    .form-group.filled .form-label {
        color: var(--success-color);
    }
`;
document.head.appendChild(style);