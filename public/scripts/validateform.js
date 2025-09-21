// Modern form validation
document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('.validated-form');
    
    forms.forEach(form => {
        const inputs = form.querySelectorAll('.form-input');
        
        // Real-time validation
        inputs.forEach(input => {
            input.addEventListener('blur', validateInput);
            input.addEventListener('input', clearErrors);
        });
        
        form.addEventListener('submit', function(event) {
            let isValid = true;
            
            inputs.forEach(input => {
                if (!validateInput.call(input)) {
                    isValid = false;
                }
            });
            
            if (!isValid) {
                event.preventDefault();
                event.stopPropagation();
            }
        });
    });
    
    function validateInput() {
        const input = this;
        const isValid = input.checkValidity();
        const feedback = input.parentNode.querySelector('.invalid-feedback');
        
        if (!isValid) {
            input.style.borderColor = 'var(--error-color)';
            if (feedback) feedback.style.display = 'block';
        } else {
            input.style.borderColor = 'var(--success-color)';
            if (feedback) feedback.style.display = 'none';
        }
        
        return isValid;
    }
    
    function clearErrors() {
        const input = this;
        const feedback = input.parentNode.querySelector('.invalid-feedback');
        
        if (input.value.length > 0) {
            input.style.borderColor = 'var(--border)';
            if (feedback) feedback.style.display = 'none';
        }
    }
});
