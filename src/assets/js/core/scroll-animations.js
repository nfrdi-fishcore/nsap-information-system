/**
 * Scroll Animations using Intersection Observer
 * Triggers CSS animations when elements enter the viewport
 */

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initScrollAnimations();
});

function initScrollAnimations() {
    // Configuration for Intersection Observer
    const observerOptions = {
        root: null, // viewport
        rootMargin: '0px 0px -100px 0px', // Trigger slightly before element is fully visible
        threshold: 0.15 // Trigger when 15% of element is visible
    };

    // Create observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add animation class when element enters viewport
                entry.target.classList.add('animate');

                // Optional: Stop observing after animation (one-time animation)
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Select all elements with data-animate attribute
    const animatedElements = document.querySelectorAll('[data-animate]');

    // Observe each element
    animatedElements.forEach(element => {
        observer.observe(element);
    });

    // Hero section - animate immediately on load
    const heroSection = document.querySelector('.hero');
    if (heroSection) {
        setTimeout(() => {
            heroSection.classList.add('animate');
        }, 100);
    }

    // Stagger feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach((card, index) => {
        card.style.transitionDelay = `${index * 0.1}s`;
    });
}

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const navbarHeight = document.querySelector('.navbar').offsetHeight;
            const targetPosition = target.offsetTop - navbarHeight - 20;

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Add parallax effect to hero background
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    if (hero && scrolled < hero.offsetHeight) {
        hero.style.backgroundPositionY = `${scrolled * 0.5}px`;
    }
});
