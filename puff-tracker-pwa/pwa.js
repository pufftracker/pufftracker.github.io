// PWA Installation and Management
class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.init();
    }

    init() {
        this.registerServiceWorker();
        this.setupInstallPrompt();
        this.checkIfInstalled();
        this.createInstallButton();
    }

    // Register service worker
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('PWA: Service Worker registered successfully:', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateAvailable();
                        }
                    });
                });
            } catch (error) {
                console.log('PWA: Service Worker registration failed:', error);
            }
        }
    }

    // Setup install prompt
    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA: Install prompt available');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWA: App installed successfully');
            this.isInstalled = true;
            this.hideInstallButton();
            this.showInstallSuccess();
        });
    }

    // Check if app is already installed
    checkIfInstalled() {
        // Check if running in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            this.isInstalled = true;
            console.log('PWA: App is running in standalone mode');
        }
    }

    // Create install button
    createInstallButton() {
        // Only show install button if not already installed
        if (this.isInstalled) return;

        const installButton = document.createElement('button');
        installButton.id = 'pwa-install-btn';
        installButton.className = 'pwa-install-button';
        installButton.innerHTML = '<i class="fas fa-download"></i> Install App';
        installButton.style.display = 'none';
        installButton.addEventListener('click', () => this.installApp());

        // Add to page
        document.body.appendChild(installButton);

        // Add CSS for install button
        this.addInstallButtonStyles();
    }

    // Show install button
    showInstallButton() {
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn && !this.isInstalled) {
            installBtn.style.display = 'flex';
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (installBtn.style.display === 'flex') {
                    installBtn.style.display = 'none';
                }
            }, 10000);
        }
    }

    // Hide install button
    hideInstallButton() {
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    }

    // Install the app
    async installApp() {
        if (!this.deferredPrompt) {
            console.log('PWA: No install prompt available');
            return;
        }

        try {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('PWA: User accepted the install prompt');
            } else {
                console.log('PWA: User dismissed the install prompt');
            }
            
            this.deferredPrompt = null;
            this.hideInstallButton();
        } catch (error) {
            console.log('PWA: Install failed:', error);
        }
    }

    // Show update available notification
    showUpdateAvailable() {
        const updateNotification = document.createElement('div');
        updateNotification.className = 'pwa-update-notification';
        updateNotification.innerHTML = `
            <div class="update-content">
                <i class="fas fa-sync-alt"></i>
                <span>App update available!</span>
                <button onclick="window.location.reload()" class="update-btn">Update</button>
                <button onclick="this.parentElement.parentElement.remove()" class="close-btn">&times;</button>
            </div>
        `;
        
        document.body.appendChild(updateNotification);
        
        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (updateNotification.parentElement) {
                updateNotification.remove();
            }
        }, 30000);
    }

    // Show install success message
    showInstallSuccess() {
        const successNotification = document.createElement('div');
        successNotification.className = 'pwa-success-notification';
        successNotification.innerHTML = `
            <div class="success-content">
                <i class="fas fa-check-circle"></i>
                <span>App installed successfully!</span>
                <button onclick="this.parentElement.parentElement.remove()" class="close-btn">&times;</button>
            </div>
        `;
        
        document.body.appendChild(successNotification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (successNotification.parentElement) {
                successNotification.remove();
            }
        }, 5000);
    }

    // Add CSS styles for PWA elements
    addInstallButtonStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .pwa-install-button {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: white;
                border: none;
                border-radius: 50px;
                padding: 12px 20px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
                z-index: 1000;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.3s ease;
                animation: slideInUp 0.5s ease;
            }

            .pwa-install-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
            }

            .pwa-install-button i {
                font-size: 16px;
            }

            .pwa-update-notification,
            .pwa-success-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 10px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                z-index: 1001;
                animation: slideInRight 0.5s ease;
            }

            .update-content,
            .success-content {
                padding: 15px 20px;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                font-weight: 500;
            }

            .update-content i {
                color: #f59e0b;
                font-size: 18px;
            }

            .success-content i {
                color: #10b981;
                font-size: 18px;
            }

            .update-btn {
                background: #6366f1;
                color: white;
                border: none;
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 12px;
                cursor: pointer;
                margin-left: 10px;
            }

            .close-btn {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #6b7280;
                margin-left: auto;
            }

            @keyframes slideInUp {
                from {
                    transform: translateY(100px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }

            @keyframes slideInRight {
                from {
                    transform: translateX(100px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            /* Hide install button on very small screens */
            @media (max-width: 480px) {
                .pwa-install-button {
                    bottom: 80px;
                    right: 15px;
                    padding: 10px 16px;
                    font-size: 12px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Check network status
    setupNetworkStatus() {
        window.addEventListener('online', () => {
            console.log('PWA: Back online');
            this.showNetworkStatus('online');
        });

        window.addEventListener('offline', () => {
            console.log('PWA: Gone offline');
            this.showNetworkStatus('offline');
        });
    }

    // Show network status
    showNetworkStatus(status) {
        const statusNotification = document.createElement('div');
        statusNotification.className = `pwa-network-status ${status}`;
        statusNotification.innerHTML = `
            <div class="status-content">
                <i class="fas ${status === 'online' ? 'fa-wifi' : 'fa-wifi-slash'}"></i>
                <span>${status === 'online' ? 'Back online' : 'You are offline'}</span>
            </div>
        `;
        
        document.body.appendChild(statusNotification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (statusNotification.parentElement) {
                statusNotification.remove();
            }
        }, 3000);
    }
}

// Initialize PWA when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const pwaManager = new PWAManager();
    window.pwaManager = pwaManager; // Make it globally accessible
});

