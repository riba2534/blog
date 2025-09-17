// Liquid Glass Dynamic Effects

(function() {
    'use strict';

    const scrollState = {
        lastScrollY: window.scrollY || 0,
        ticking: false,
        initialized: false
    };

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
        initLiquidGlass();
    });

    function initLiquidGlass() {
        // Add glass effect classes to elements
        addGlassEffects();

        // Initialize dynamic lighting
        initDynamicLighting();

        // Initialize scroll effects
        initScrollEffects();

        // Initialize interactive ripples
        initRippleEffects();

        // Initialize adaptive tinting
        initAdaptiveTinting();
    }

    function addGlassEffects() {
        // Add animation classes to post items
        const postItems = document.querySelectorAll('.post-item-wrapper');
        postItems.forEach((item, index) => {
            item.classList.add('animate-fade-in');
            item.style.animationDelay = `${index * 50}ms`;
        });

        // Add glass layer class for GPU optimization
        const glassElements = document.querySelectorAll('.side-container, .post-item-wrapper, .toc-container, pre, blockquote');
        glassElements.forEach(el => {
            el.classList.add('glass-layer');
        });
    }

    function initDynamicLighting() {
        let mouseX = 0;
        let mouseY = 0;
        let currentX = 0;
        let currentY = 0;
        const speed = 0.08;

        document.addEventListener('mousemove', (e) => {
            mouseX = (e.clientX / window.innerWidth - 0.5) * 20;
            mouseY = (e.clientY / window.innerHeight - 0.5) * 20;
        });

        function animate() {
            currentX += (mouseX - currentX) * speed;
            currentY += (mouseY - currentY) * speed;

            // Update CSS variables for dynamic lighting
            document.documentElement.style.setProperty('--lg-light-x', `${50 + currentX}%`);
            document.documentElement.style.setProperty('--lg-light-y', `${50 + currentY}%`);

            requestAnimationFrame(animate);
        }

        animate();
    }

    function initScrollEffects() {
        scrollState.lastScrollY = window.scrollY || 0;
        updateScrollEffects();

        if (!scrollState.initialized) {
            window.addEventListener('scroll', requestTick);
            scrollState.initialized = true;
        }
    }

    function updateScrollEffects() {
        const scrollY = window.scrollY;
        const scrollDelta = scrollY - scrollState.lastScrollY;

        // Parallax effect for background
        const body = document.body;
        if (body) {
            body.style.backgroundPositionY = `${scrollY * 0.5}px`;
        }

        // Dynamic blur intensity based on scroll speed
        const blurIntensity = Math.min(Math.abs(scrollDelta) * 2, 30);
        document.documentElement.style.setProperty('--lg-scroll-blur', `${blurIntensity}px`);

        // Fade in elements as they come into view
        const elements = document.querySelectorAll('.post-item-wrapper:not(.in-view)');
        elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.8 && rect.bottom > 0) {
                el.classList.add('in-view');
                el.style.animation = 'fadeInGlass 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
            }
        });

        // Update sidebar opacity based on scroll
        const sidebar = document.querySelector('.side-container');
        if (sidebar) {
            const opacity = Math.max(0.7, 1 - scrollY / 500);
            sidebar.style.opacity = opacity;
        }

        // Shrink navigation when scrolling
        const navContainer = document.querySelector('.nav-container');
        if (navContainer) {
            if (scrollY > 50) {
                navContainer.classList.add('scrolled');
            } else {
                navContainer.classList.remove('scrolled');
            }
        }

        scrollState.lastScrollY = scrollY;
        scrollState.ticking = false;
    }

    function requestTick() {
        if (!scrollState.ticking) {
            requestAnimationFrame(updateScrollEffects);
            scrollState.ticking = true;
        }
    }

    function initRippleEffects() {
        const clickableElements = document.querySelectorAll('.post-item-wrapper, .nav-link-item, button, a');

        clickableElements.forEach(el => {
            el.addEventListener('click', function(e) {
                // Remove existing ripple
                const existingRipple = this.querySelector('.ripple-effect');
                if (existingRipple) {
                    existingRipple.remove();
                }

                // Create ripple
                const ripple = document.createElement('span');
                ripple.className = 'ripple-effect';

                // Calculate size and position
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;

                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';

                this.appendChild(ripple);

                // Remove ripple after animation
                setTimeout(() => {
                    ripple.remove();
                }, 600);
            });
        });
    }

    function initAdaptiveTinting() {
        const adaptiveElements = document.querySelectorAll('.post-item-wrapper');

        adaptiveElements.forEach(el => {
            // Extract dominant color from featured image if exists
            const image = el.querySelector('.post-item-image');
            if (image) {
                const imgUrl = window.getComputedStyle(image).backgroundImage;
                if (imgUrl && imgUrl !== 'none') {
                    // Add adaptive tint class
                    el.classList.add('adaptive-tint');

                    // Create subtle color overlay
                    const overlay = document.createElement('div');
                    overlay.className = 'color-overlay';
                    overlay.style.position = 'absolute';
                    overlay.style.inset = '0';
                    overlay.style.background = 'inherit';
                    overlay.style.filter = 'blur(100px) saturate(200%)';
                    overlay.style.opacity = '0.05';
                    overlay.style.zIndex = '0';
                    overlay.style.pointerEvents = 'none';

                    el.style.position = 'relative';
                    el.insertBefore(overlay, el.firstChild);
                }
            }
        });
    }

    // Add custom CSS for ripple effect
    const style = document.createElement('style');
    style.textContent = `
        .ripple-effect {
            position: absolute;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%);
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none;
            z-index: 100;
        }

        @keyframes ripple-animation {
            to {
                transform: scale(2);
                opacity: 0;
            }
        }

        .in-view {
            opacity: 1;
        }

        .post-item-wrapper:not(.in-view) {
            opacity: 0;
            transform: translateY(20px);
        }

        .color-overlay {
            transition: opacity 0.3s ease;
        }

        .post-item-wrapper:hover .color-overlay {
            opacity: 0.1 !important;
        }
    `;
    document.head.appendChild(style);

    // Performance optimization: Throttle resize events
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            initScrollEffects();
        }, 250);
    });

})();
