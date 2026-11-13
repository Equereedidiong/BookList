/**
 * BookList App
 * Features:
 * - Add, Edit, Delete (with confirmation) books
 * - Toggle read status directly from list
 * - Real-time search by title or author
 * - Header statistics (Total, Read, Unread)
 * - Empty state notifications
 * - LocalStorage persistence across page reloads
 */

(() => {
  'use strict';

  // --- Constants & Storage Key ---
  const STORAGE_KEY = 'simple_booklist_data';

  // Sample starter books (only loaded on very first visit if storage is null)
  const INITIAL_BOOKS = [
    {
      id: 'book-1',
      title: 'To Kill a Mockingbird',
      author: 'Harper Lee',
      isRead: true,
      rating: 5,
      createdAt: Date.now() - 200000
    },
    {
      id: 'book-2',
      title: 'Atomic Habits',
      author: 'James Clear',
      isRead: true,
      rating: 4,
      createdAt: Date.now() - 100000
    },
    {
      id: 'book-3',
      title: '1984',
      author: 'George Orwell',
      isRead: false,
      rating: 5,
      createdAt: Date.now()
    }
  ];

  // --- DOM Elements ---
  const bookForm = document.getElementById('bookForm');
  const formHeading = document.getElementById('formHeading');
  const bookIdInput = document.getElementById('bookIdInput');
  const titleInput = document.getElementById('titleInput');
  const authorInput = document.getElementById('authorInput');
  const starRatingPicker = document.getElementById('starRatingPicker');
  const ratingInput = document.getElementById('ratingInput');
  const ratingDisplayText = document.getElementById('ratingDisplayText');
  const starButtons = starRatingPicker.querySelectorAll('.star-btn');
  const readCheckbox = document.getElementById('readCheckbox');
  const submitBtn = document.getElementById('submitBtn');
  const submitBtnText = document.getElementById('submitBtnText');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const titleError = document.getElementById('titleError');
  const authorError = document.getElementById('authorError');

  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const bookList = document.getElementById('bookList');
  const emptyState = document.getElementById('emptyState');
  const emptyTitle = document.getElementById('emptyTitle');
  const emptyDescription = document.getElementById('emptyDescription');
  const emptyIcon = document.getElementById('emptyIcon');

  const totalBooksCount = document.getElementById('totalBooksCount');
  const readBooksCount = document.getElementById('readBooksCount');
  const unreadBooksCount = document.getElementById('unreadBooksCount');

  // Confirmation Modal
  const deleteDialog = document.getElementById('deleteDialog');
  const deleteDialogMessage = document.getElementById('deleteDialogMessage');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  // --- Application State ---
  let books = [];
  let pendingDeleteId = null;

  // --- Storage Functions ---
  function loadBooks() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        // Ensure backwards compatibility with records before rating was added
        books = parsed.map(book => ({
          ...book,
          rating: typeof book.rating === 'number' ? book.rating : 5
        }));
      } else {
        // First visit: initialize with starter books
        books = INITIAL_BOOKS;
        saveBooks();
      }
    } catch (err) {
      console.error('Error loading books from localStorage:', err);
      books = [];
    }
  }

  function saveBooks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
    } catch (err) {
      console.error('Error saving books to localStorage:', err);
    }
  }

  // --- Utility Functions ---
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function generateId() {
    return 'book-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
  }

  // --- Render Functions ---
  function updateStats() {
    const total = books.length;
    const read = books.filter(b => b.isRead).length;
    const unread = total - read;

    totalBooksCount.textContent = total;
    readBooksCount.textContent = read;
    unreadBooksCount.textContent = unread;
  }

  function setFormRating(val) {
    const rating = Math.max(1, Math.min(5, parseInt(val, 10) || 5));
    ratingInput.value = rating;
    ratingDisplayText.textContent = `${rating} / 5 stars`;
    starButtons.forEach(btn => {
      const btnVal = parseInt(btn.getAttribute('data-value'), 10);
      btn.classList.toggle('active', btnVal <= rating);
    });
  }

  function renderStars(rating) {
    const r = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      const isFilled = i <= r;
      starsHtml += `<span class="star ${isFilled ? 'filled' : 'empty'}">${isFilled ? '★' : '☆'}</span>`;
    }
    return `
      <div class="star-display" aria-label="${r} out of 5 stars">
        ${starsHtml}
        <span class="rating-val">(${r}/5)</span>
      </div>
    `;
  }

  function renderBooks() {
    updateStats();

    const searchTerm = searchInput.value.trim().toLowerCase();
    clearSearchBtn.classList.toggle('hidden', searchTerm === '');

    // Filter books based on search term
    const filteredBooks = books.filter(book => {
      const titleMatch = book.title.toLowerCase().includes(searchTerm);
      const authorMatch = book.author.toLowerCase().includes(searchTerm);
      return titleMatch || authorMatch;
    });

    // Check if editing
    const editingId = bookIdInput.value;

    // Handle Empty State
    if (filteredBooks.length === 0) {
      bookList.innerHTML = '';
      emptyState.classList.remove('hidden');

      if (books.length === 0) {
        emptyIcon.textContent = '📚';
        emptyTitle.textContent = 'Your book list is empty';
        emptyDescription.textContent = 'Start tracking your library by adding your first book above!';
      } else {
        emptyIcon.textContent = '🔍';
        emptyTitle.textContent = 'No matching books found';
        emptyDescription.textContent = `No books match "${escapeHtml(searchTerm)}". Try searching for another title or author.`;
      }
      return;
    }

    emptyState.classList.add('hidden');

    // Build Book Items
    bookList.innerHTML = filteredBooks.map(book => {
      const isCurrentlyEditing = book.id === editingId;
      const statusClass = book.isRead ? 'read' : 'unread';
      const statusText = book.isRead ? '✓ Read' : '○ Not Read';
      const toggleAria = book.isRead ? 'Mark as not read' : 'Mark as read';

      return `
        <article class="book-item ${isCurrentlyEditing ? 'editing' : ''}" data-id="${escapeHtml(book.id)}" role="listitem">
          <div class="book-info">
            <h3 class="book-title">${escapeHtml(book.title)}</h3>
            <p class="book-author">by ${escapeHtml(book.author)}</p>
            <div class="book-rating">${renderStars(book.rating || 5)}</div>
          </div>
          <div class="book-footer">
            <button 
              type="button" 
              class="status-badge ${statusClass}" 
              data-action="toggle-status" 
              data-id="${escapeHtml(book.id)}"
              title="Click to toggle status"
              aria-label="${toggleAria}">
              ${statusText}
            </button>
            <div class="item-actions">
              <button 
                type="button" 
                class="action-btn edit-btn" 
                data-action="edit" 
                data-id="${escapeHtml(book.id)}"
                aria-label="Edit book ${escapeHtml(book.title)}">
                ✎ Edit
              </button>
              <button 
                type="button" 
                class="action-btn delete-btn" 
                data-action="delete" 
                data-id="${escapeHtml(book.id)}"
                aria-label="Delete book ${escapeHtml(book.title)}">
                ✕ Delete
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // --- Form & Edit Management ---
  function resetForm() {
    bookForm.reset();
    bookIdInput.value = '';
    formHeading.textContent = 'Add a New Book';
    submitBtnText.textContent = 'Add Book';
    cancelEditBtn.classList.add('hidden');
    setFormRating(5);
    clearValidationErrors();
    renderBooks();
  }

  function clearValidationErrors() {
    titleError.textContent = '';
    authorError.textContent = '';
  }

  function startEditBook(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;

    bookIdInput.value = book.id;
    titleInput.value = book.title;
    authorInput.value = book.author;
    readCheckbox.checked = !!book.isRead;
    setFormRating(book.rating || 5);

    formHeading.textContent = 'Edit Book';
    submitBtnText.textContent = 'Save Changes';
    cancelEditBtn.classList.remove('hidden');
    clearValidationErrors();

    // Scroll form into view smoothly
    bookForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    titleInput.focus();

    renderBooks();
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    clearValidationErrors();

    const title = titleInput.value.trim();
    const author = authorInput.value.trim();
    const isRead = readCheckbox.checked;
    const rating = Math.max(1, Math.min(5, parseInt(ratingInput.value, 10) || 5));
    const editId = bookIdInput.value;

    let hasError = false;

    if (!title) {
      titleError.textContent = 'Please enter a book title.';
      hasError = true;
    }

    if (!author) {
      authorError.textContent = 'Please enter the author name.';
      hasError = true;
    }

    if (hasError) return;

    if (editId) {
      // Update existing book
      const bookIndex = books.findIndex(b => b.id === editId);
      if (bookIndex !== -1) {
        books[bookIndex].title = title;
        books[bookIndex].author = author;
        books[bookIndex].isRead = isRead;
        books[bookIndex].rating = rating;
      }
    } else {
      // Add new book to beginning of list
      const newBook = {
        id: generateId(),
        title,
        author,
        isRead,
        rating,
        createdAt: Date.now()
      };
      books.unshift(newBook);
    }

    saveBooks();
    resetForm();
  }

  // --- Status Toggle & Actions ---
  function toggleBookStatus(id) {
    const book = books.find(b => b.id === id);
    if (book) {
      book.isRead = !book.isRead;
      saveBooks();
      renderBooks();
    }
  }

  // --- Deletion & Confirmation Modal ---
  function requestDeleteBook(id) {
    const book = books.find(b => b.id === id);
    if (!book) return;

    pendingDeleteId = id;

    // Use native <dialog> if supported, with fallback
    if (typeof deleteDialog.showModal === 'function') {
      deleteDialogMessage.textContent = `Are you sure you want to delete "${book.title}" by ${book.author}?`;
      deleteDialog.showModal();
    } else {
      // Browser fallback
      const confirmed = window.confirm(`Are you sure you want to delete "${book.title}"?`);
      if (confirmed) {
        executeDelete(id);
      }
    }
  }

  function closeDeleteDialog() {
    pendingDeleteId = null;
    if (typeof deleteDialog.close === 'function') {
      deleteDialog.close();
    }
  }

  function executeDelete(id) {
    // If the book being deleted is currently being edited, reset the form
    if (bookIdInput.value === id) {
      resetForm();
    }

    books = books.filter(b => b.id !== id);
    saveBooks();
    renderBooks();
  }

  // --- Event Listeners ---
  bookForm.addEventListener('submit', handleFormSubmit);

  cancelEditBtn.addEventListener('click', () => {
    resetForm();
  });

  // Real-time search filtering
  searchInput.addEventListener('input', () => {
    renderBooks();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    renderBooks();
  });

  // Event Delegation for book list items
  bookList.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');

    if (action === 'toggle-status') {
      toggleBookStatus(id);
    } else if (action === 'edit') {
      startEditBook(id);
    } else if (action === 'delete') {
      requestDeleteBook(id);
    }
  });

  // Modal event listeners
  confirmDeleteBtn.addEventListener('click', () => {
    if (pendingDeleteId) {
      const idToDelete = pendingDeleteId;
      closeDeleteDialog();
      executeDelete(idToDelete);
    }
  });

  cancelDeleteBtn.addEventListener('click', closeDeleteDialog);

  // Close dialog on backdrop click
  deleteDialog.addEventListener('click', (e) => {
    const rect = deleteDialog.getBoundingClientRect();
    const isInDialog = (
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width
    );
    if (!isInDialog) {
      closeDeleteDialog();
    }
  });

  // Input validation clearing on user typing
  titleInput.addEventListener('input', () => {
    if (titleInput.value.trim()) titleError.textContent = '';
  });

  authorInput.addEventListener('input', () => {
    if (authorInput.value.trim()) authorError.textContent = '';
  });

  // Star rating picker event listeners
  starButtons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      const hoverVal = parseInt(btn.getAttribute('data-value'), 10);
      starButtons.forEach(b => {
        const bVal = parseInt(b.getAttribute('data-value'), 10);
        b.classList.toggle('hover', bVal <= hoverVal);
      });
    });

    btn.addEventListener('click', () => {
      const selectedVal = parseInt(btn.getAttribute('data-value'), 10);
      setFormRating(selectedVal);
    });
  });

  starRatingPicker.addEventListener('mouseleave', () => {
    starButtons.forEach(b => b.classList.remove('hover'));
  });

  // --- Initialization ---
  loadBooks();
  setFormRating(5);
  renderBooks();
})();

