// Liquid Glass Dynamic Effects - Optimized Version

(function() {
    'use strict';

    // State management
    const state = {
        scroll: {
            lastY: 0,
            ticking: false,
            initialized: false
        },
        mouse: {
            x: 0,
            y: 0,
            currentX: 0,
            currentY: 0,
            isMoving: false,
            animationId: null,
            idleTimeout: null
        },
        // Cache DOM queries
        cache: {
            postItems: null,
            sidebar: null,
            navContainer: null
        }
    };

    const CONFIG = {
        MOUSE_SPEED: 0.08,
        MOUSE_IDLE_DELAY: 2000,  // Stop animation after 2s idle
        SCROLL_BLUR_MAX: 30,
        RIPPLE_DURATION: 600
    };

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', initLiquidGlass);

    function initLiquidGlass() {
        // Cache DOM elements once
        cacheElements();

        // Add glass effects
        addGlassEffects();

        // Initialize effects
        initDynamicLighting();
        initScrollEffects();
        initRippleEffects();

        // Skip adaptive tinting - too expensive
        // initAdaptiveTinting();
    }

    function cacheElements() {
        state.cache.postItems = document.querySelectorAll('.post-item-wrapper');
        state.cache.sidebar = document.querySelector('.side-container');
        state.cache.navContainer = document.querySelector('.nav-container');
    }

    function addGlassEffects() {
        // Add animation classes to post items
        state.cache.postItems.forEach((item, index) => {
            item.classList.add('animate-fade-in');
            item.style.animationDelay = `${index * 50}ms`;
        });

        // Add glass layer class for GPU optimization
        const glassElements = document.querySelectorAll('.side-container, .post-item-wrapper, .toc-container, pre, blockquote');
        glassElements.forEach(el => el.classList.add('glass-layer'));
    }

    function initDynamicLighting() {
        const root = document.documentElement;

        // Throttled mousemove handler
        document.addEventListener('mousemove', (e) => {
            state.mouse.x = (e.clientX / window.innerWidth - 0.5) * 20;
            state.mouse.y = (e.clientY / window.innerHeight - 0.5) * 20;

            // Mark as moving and start animation if not running
            if (!state.mouse.isMoving) {
                state.mouse.isMoving = true;
                startLightingAnimation();
            }

            // Reset idle timeout
            clearTimeout(state.mouse.idleTimeout);
            state.mouse.idleTimeout = setTimeout(() => {
                state.mouse.isMoving = false;
            }, CONFIG.MOUSE_IDLE_DELAY);
        });

        function startLightingAnimation() {
            if (state.mouse.animationId) return;

            function animate() {
                // Stop if mouse is idle and values have converged
                const deltaX = Math.abs(state.mouse.x - state.mouse.currentX);
                const deltaY = Math.abs(state.mouse.y - state.mouse.currentY);

                if (!state.mouse.isMoving && deltaX < 0.01 && deltaY < 0.01) {
                    state.mouse.animationId = null;
                    return;
                }

                state.mouse.currentX += (state.mouse.x - state.mouse.currentX) * CONFIG.MOUSE_SPEED;
                state.mouse.currentY += (state.mouse.y - state.mouse.currentY) * CONFIG.MOUSE_SPEED;

                root.style.setProperty('--lg-light-x', `${50 + state.mouse.currentX}%`);
                root.style.setProperty('--lg-light-y', `${50 + state.mouse.currentY}%`);

                state.mouse.animationId = requestAnimationFrame(animate);
            }

            animate();
        }
    }

    function initScrollEffects() {
        state.scroll.lastY = window.scrollY || 0;

        // Initial update
        updateScrollEffects();

        if (!state.scroll.initialized) {
            window.addEventListener('scroll', requestTick, { passive: true });
            state.scroll.initialized = true;
        }
    }

    function updateScrollEffects() {
        const scrollY = window.scrollY;
        const scrollDelta = scrollY - state.scroll.lastY;
        const root = document.documentElement;

        // Dynamic blur intensity (throttled by RAF already)
        const blurIntensity = Math.min(Math.abs(scrollDelta) * 2, CONFIG.SCROLL_BLUR_MAX);
        root.style.setProperty('--lg-scroll-blur', `${blurIntensity}px`);

        // Fade in elements - use cached and filter
        state.cache.postItems.forEach(el => {
            if (el.classList.contains('in-view')) return;

            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.8 && rect.bottom > 0) {
                el.classList.add('in-view');
            }
        });

        // Update sidebar opacity
        if (state.cache.sidebar) {
            const opacity = Math.max(0.7, 1 - scrollY / 500);
            state.cache.sidebar.style.opacity = opacity;
        }

        // Navigation scroll state
        if (state.cache.navContainer) {
            state.cache.navContainer.classList.toggle('scrolled', scrollY > 50);
        }

        state.scroll.lastY = scrollY;
        state.scroll.ticking = false;
    }

    function requestTick() {
        if (!state.scroll.ticking) {
            requestAnimationFrame(updateScrollEffects);
            state.scroll.ticking = true;
        }
    }

    function initRippleEffects() {
        // Use event delegation instead of attaching to every element
        document.addEventListener('click', (e) => {
            const target = e.target.closest('.post-item-wrapper, button');
            if (!target) return;

            // Remove existing ripple
            const existingRipple = target.querySelector('.ripple-effect');
            if (existingRipple) existingRipple.remove();

            // Create ripple
            const ripple = document.createElement('span');
            ripple.className = 'ripple-effect';

            const rect = target.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            Object.assign(ripple.style, {
                width: size + 'px',
                height: size + 'px',
                left: x + 'px',
                top: y + 'px'
            });

            target.appendChild(ripple);

            setTimeout(() => ripple.remove(), CONFIG.RIPPLE_DURATION);
        });
    }

    // Inject minimal CSS
    const style = document.createElement('style');
    style.textContent = `
        .ripple-effect {
            position: absolute;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%);
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none;
            z-index: 100;
        }
        @keyframes ripple-animation {
            to { transform: scale(2); opacity: 0; }
        }
        .in-view {
            opacity: 1;
            transform: translateY(0);
        }
        .post-item-wrapper:not(.in-view) {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.5s ease, transform 0.5s ease;
        }
    `;
    document.head.appendChild(style);

    // Throttled resize handler
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            cacheElements();
            initScrollEffects();
        }, 250);
    });

})();
