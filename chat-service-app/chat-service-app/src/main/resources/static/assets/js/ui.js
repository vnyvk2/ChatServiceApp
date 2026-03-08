/**
 * UI Module - Handles modals, toasts, layout helpers, and utility functions.
 */

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function showToast(message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${icons[type] || icons.info}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

export function showModal(modalId) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(modalId).classList.remove('hidden');
}

export function closeModals() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
    });
}

export function scrollToBottom() {
    const messageArea = document.getElementById('chat-messages');
    if (messageArea) messageArea.scrollTop = messageArea.scrollHeight;
}

export function adjustLayout() {
    const isMobile = window.innerWidth < 768;
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    if (isMobile) {
        sidebar?.classList.add('mobile');
        mainContent?.classList.add('mobile');
    } else {
        sidebar?.classList.remove('mobile');
        mainContent?.classList.remove('mobile');
    }
}

export function setButtonLoading(buttonType, isLoading) {
    const button = document.getElementById(`${buttonType}-btn`);
    if (!button) return;

    button.disabled = isLoading;
    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.textContent = 'Loading...';
    } else {
        button.textContent = button.dataset.originalText || button.textContent;
    }
}
