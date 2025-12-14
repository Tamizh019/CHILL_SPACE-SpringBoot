/* --- Particle Config --- */
document.addEventListener('DOMContentLoaded', () => {
    if (window.particlesJS) {
        particlesJS("particles-js", {
            particles: {
                number: {
                    value: window.innerWidth < 768 ? 80 : 150,
                    density: { enable: true, value_area: 1200 }
                },
                color: { value: ["#ffffff", "#f0f8ff", "#e6f3ff", "#ffd700"] },
                shape: {
                    type: "star",
                    stroke: { width: 0, color: "#000000" },
                    polygon: { nb_sides: 5 }
                },
                opacity: {
                    value: 0.8,
                    random: true,
                    anim: { enable: true, speed: 2, opacity_min: 0.1, sync: false }
                },
                size: {
                    value: 2,
                    random: true,
                    anim: { enable: true, speed: 3, size_min: 0.5, sync: false }
                },
                line_linked: { enable: false },
                move: {
                    enable: true,
                    speed: 0.3,
                    direction: "none",
                    random: true,
                    straight: false,
                    out_mode: "out",
                    bounce: false,
                    attract: { enable: false }
                }
            },
            interactivity: {
                detect_on: "canvas",
                events: {
                    onhover: { enable: true, mode: "bubble" },
                    onclick: { enable: true, mode: "push" },
                    resize: true
                },
                modes: {
                    bubble: { distance: 150, size: 8, duration: 1.5, opacity: 1, speed: 2 },
                    repulse: { distance: 100, duration: 0.4 },
                    push: { particles_nb: 3 },
                    grab: { distance: 200, line_linked: { opacity: 0.8 } }
                }
            },
            retina_detect: true
        });
    }

    /* --- Form Handlers --- */

    // LOGIN FORM
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const messageEl = document.getElementById('loginMessage');
            const loginBtn = loginForm.querySelector('button[type="submit"]');

            // Gather inputs (assuming email field is used for username)
            const username = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            // UI Reset
            messageEl.style.display = 'none';
            messageEl.className = 'status-message';
            const originalText = loginBtn.textContent;
            loginBtn.disabled = true;
            loginBtn.textContent = 'Logging in...';

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Login failed');
                }

                // Success
                localStorage.setItem('jwt_token', data.token);
                localStorage.setItem('user_info', JSON.stringify({
                    username: data.username,
                    role: data.role,
                    id: data.id
                }));

                // Show Loading and Redirect
                showLoadingScreenWithQuote();
                document.querySelector('.glass-hero').style.opacity = '0.3';

                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 2000);

            } catch (error) {
                console.error(error);
                showMessage(messageEl, 'Invalid credentials', 'error');
                shakeCard();
                loginBtn.disabled = false;
                loginBtn.textContent = originalText;
            }
        });
    }

    // REGISTER FORM (Supabase OTP Flow)
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {

        // Initialize Supabase
        // Initialize Supabase Dynamically
        let supabase;

        // Fetch config first
        fetch('/api/config/supabase')
            .then(res => res.json())
            .then(config => {
                supabase = window.supabase.createClient(config.url, config.key);
                console.log('✅ Supabase initialized');
            })
            .catch(err => console.error('❌ Failed to load config:', err));

        let isOtpSent = false;

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const messageEl = document.getElementById('registerMessage');
            const submitBtn = registerForm.querySelector('button[type="submit"]');

            if (!supabase) {
                showMessage(messageEl, "System initializing... please wait", 'error');
                return;
            }

            // Inputs
            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const otpInput = document.getElementById('otp').value.trim();

            const otpGroup = document.getElementById('otpGroup');
            const otherInputs = registerForm.querySelectorAll('.input-wrapper:not(#otpGroup)');

            // Reset UI
            messageEl.style.display = 'none';
            messageEl.className = 'status-message';
            shakeCard(); // Shake on error only

            /* --- STEP 1: REQUEST OTP --- */
            if (!isOtpSent) {
                // Validation
                if (password !== confirmPassword) {
                    showMessage(messageEl, "Passwords do not match", 'error');
                    shakeCard();
                    return;
                }
                if (password.length < 6) {
                    showMessage(messageEl, "Password must be at least 6 characters", 'error');
                    shakeCard();
                    return;
                }

                // UI Loading
                const originalText = submitBtn.textContent;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending Code...';

                try {
                    // Send OTP via Supabase
                    const { data, error } = await supabase.auth.signInWithOtp({
                        email: email,
                        options: {
                            shouldCreateUser: true // Create user if not exists
                        }
                    });

                    if (error) throw error;

                    // Success UI Transition
                    isOtpSent = true;
                    // Hide other inputs to focus on OTP
                    otherInputs.forEach(el => el.style.display = 'none');
                    otpGroup.style.display = 'block';

                    submitBtn.innerHTML = '<span class="btn-text">Verify & Register</span><div class="btn-shine"></div>';
                    submitBtn.disabled = false;
                    showMessage(messageEl, `Code sent to ${email}`, 'success');

                } catch (error) {
                    console.error('Supabase Error:', error);
                    showMessage(messageEl, error.message, 'error');
                    shakeCard();
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }

                /* --- STEP 2: VERIFY OTP & REGISTER --- */
            } else {
                if (otpInput.length < 6) {
                    showMessage(messageEl, "Enter valid 6-digit code", 'error');
                    shakeCard();
                    return;
                }

                // UI Loading
                const originalText = submitBtn.textContent;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Verifying...';

                try {
                    // Verify OTP
                    const { data, error } = await supabase.auth.verifyOtp({
                        email: email,
                        token: otpInput,
                        type: 'email'
                    });

                    if (error) throw error;

                    const session = data.session;
                    if (!session) throw new Error("Verification failed. Try again.");

                    // Call Local Backend to Create User
                    submitBtn.textContent = 'Finalizing...';

                    const backendResponse = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username,
                            email,
                            password,
                            supabaseAccessToken: session.access_token // Send token for server validation
                        })
                    });

                    const text = await backendResponse.text();

                    if (!backendResponse.ok) {
                        throw new Error(text || 'Registration failed on server');
                    }

                    // Success!
                    showMessage(messageEl, 'Account verified & created! Redirecting...', 'success');
                    document.querySelector('.glass-hero').style.opacity = '0.5';

                    // Cleanup Supabase session (optional, since we use our own JWT)
                    await supabase.auth.signOut();

                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);

                } catch (error) {
                    console.error('Verification Error:', error);
                    showMessage(messageEl, error.message, 'error');
                    shakeCard();
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            }
        });
    }
});

/* --- UI Utilities --- */

function showMessage(element, text, type) {
    if (!element) return;
    element.textContent = text;
    element.className = 'status-message ' + type; // Assumes CSS has .error and .success
    element.style.display = 'block';
    if (type === 'error') element.style.color = 'var(--error)';
    if (type === 'success') element.style.color = 'var(--success)';
}

function shakeCard() {
    const card = document.querySelector('.glass-hero');
    if (card) {
        card.classList.add('error-shake');
        setTimeout(() => card.classList.remove('error-shake'), 500);
    }
}

// Random Quotes for Loading Screen
const inspirationalQuotes = [
    { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
    { text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House" },
    { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" }
];

function showLoadingScreenWithQuote() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const quoteText = document.getElementById('quoteText');
    const quoteAuthor = document.getElementById('quoteAuthor');

    if (!loadingOverlay) return;

    if (quoteText && quoteAuthor) {
        const randomQuote = inspirationalQuotes[Math.floor(Math.random() * inspirationalQuotes.length)];
        quoteText.textContent = `"${randomQuote.text}"`;
        quoteAuthor.textContent = `— ${randomQuote.author}`;
    }

    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.opacity = '1';
}
